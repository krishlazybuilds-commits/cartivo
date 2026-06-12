"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";

/**
 * "Sign in with Google" using Google Identity Services (GIS).
 *
 * When NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, we load Google's GIS script and let
 * it render the official button. On selection Google returns a signed ID token
 * (`credential`), which we POST to the backend (/auth/google/) where it's
 * verified and exchanged for our httpOnly JWT cookies.
 *
 * Without a client ID configured, we fall back to a styled placeholder button
 * so the auth pages still render cleanly.
 */
const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/** Load the GIS client script once and resolve when google.accounts.id exists. */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.google?.accounts?.id) return resolve();

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(script);
  });
}

export default function GoogleButton({ action = "Sign in", next = "/products" }) {
  const toast = useToast();
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const containerRef = useRef(null);

  const handleCredential = useCallback(
    async (response) => {
      try {
        await loginWithGoogle(response.credential);
        toast(
          action === "Sign up" ? "Account created successfully" : "Signed in successfully",
          "success"
        );
        router.push(next || "/products");
      } catch (err) {
        toast(err.message || "Google sign-in failed", "error");
      }
    },
    [action, loginWithGoogle, next, router, toast]
  );

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
        });
        // Clear any prior render (e.g. on hot reload) before rendering again.
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: action === "Sign up" ? "signup_with" : "signin_with",
          logo_alignment: "center",
          width: 320,
        });
      })
      .catch(() => {
        if (!cancelled) toast("Couldn't load Google sign-in", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [action, handleCredential, toast]);

  // Feature not configured: render a non-functional branded placeholder.
  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        className="google-btn"
        onClick={() => toast("Google sign-in is not configured", "info")}
      >
        <svg className="google-btn-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span>{action} with Google</span>
      </button>
    );
  }

  // GIS renders the official Google button into this container.
  return <div ref={containerRef} className="google-btn-gis" />;
}
