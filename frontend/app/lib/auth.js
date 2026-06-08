"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

import { API_URL } from "./api";

const ACCESS_KEY = "cartivo_access";
const REFRESH_KEY = "cartivo_refresh";

const AuthContext = createContext(null);

/**
 * Extract a human-readable message from any DRF error body:
 *   "msg" | ["msg"] | {detail: "msg"} | {detail: ["msg"]} |
 *   {non_field_errors: ["msg"]} | {field: ["msg"]}
 */
export function extractError(data, fallback = "Something went wrong.") {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data[0] ?? fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) return data.detail[0] ?? fallback;
  const first = Object.values(data).flat()[0];
  return typeof first === "string" ? first : fallback;
}

function getToken(key) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setTokens(access, refresh) {
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

/**
 * Authenticated fetch against the API. Attaches the JWT access token and, on a
 * 401, transparently tries to refresh it once before giving up.
 */
export async function authFetch(path, options = {}) {
  const access = getToken(ACCESS_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (access) headers.Authorization = `Bearer ${access}`;

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && getToken(REFRESH_KEY)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${getToken(ACCESS_KEY)}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = { detail: res.statusText };
    }
    const err = new Error(extractError(detail, `Request failed (${res.status})`));
    err.status = res.status;
    err.data = detail;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}

async function tryRefresh() {
  const refresh = getToken(REFRESH_KEY);
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  setTokens(data.access, data.refresh);
  return true;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getToken(ACCESS_KEY)) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authFetch("/auth/me/");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (username, password) => {
      const res = await fetch(`${API_URL}/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid username or password.");
      }
      const data = await res.json();
      setTokens(data.access, data.refresh);
      await loadUser();
    },
    [loadUser]
  );

  const register = useCallback(
    async (payload) => {
      const res = await fetch(`${API_URL}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Surface the first field error if present.
        const firstError =
          typeof data === "object" && data
            ? Object.values(data).flat()[0]
            : null;
        throw new Error(firstError || "Registration failed.");
      }
      // Auto-login after successful registration.
      await login(payload.username, payload.password);
    },
    [login]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
