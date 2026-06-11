"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

import { API_URL } from "./api";

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

const UNSAFE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Ensure the csrftoken cookie is present. Hits the backend bootstrap endpoint
 * (which sets the cookie) only when we don't already have one.
 */
async function ensureCsrfToken() {
  if (getCookie("csrftoken")) return getCookie("csrftoken");
  await fetch(`${API_URL}/auth/csrf/`, { credentials: "include" });
  return getCookie("csrftoken");
}

/**
 * Authenticated fetch. Auth travels via httpOnly cookies (sent automatically
 * with `credentials: "include"`), so there are no tokens to attach. For unsafe
 * methods we send the CSRF token header. On a 401 we transparently try a token
 * refresh once before giving up.
 */
export async function authFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  // When sending FormData (e.g. image uploads) let the browser set the
  // multipart Content-Type with its boundary — don't force JSON.
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (UNSAFE_METHODS.includes(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers["X-CSRFToken"] = csrf;
  }

  const doFetch = () =>
    fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });

  let res = await doFetch();

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
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
  const csrf = await ensureCsrfToken();
  const res = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    credentials: "include",
  });
  return res.ok;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
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
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_URL}/auth/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRFToken": csrf } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid username or password.");
      }
      await loadUser();
    },
    [loadUser]
  );

  const register = useCallback(
    async (payload) => {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_URL}/auth/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRFToken": csrf } : {}),
        },
        credentials: "include",
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

  const logout = useCallback(async () => {
    try {
      await authFetch("/auth/logout/", { method: "POST" });
    } catch {
      // Even if the server call fails, drop the local user state.
    }
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
