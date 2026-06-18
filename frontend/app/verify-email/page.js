"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import { API_URL } from "../lib/api";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      setStatus("error");
      setErrorMsg("Invalid verification link.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(data.detail || "Verification failed.");
          setStatus("error");
          return;
        }
        setStatus("done");
        setTimeout(() => router.push("/login"), 2500);
      } catch {
        if (!cancelled) {
          setErrorMsg("Something went wrong. Please try again.");
          setStatus("error");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [uid, token, router]);

  if (status === "verifying") {
    return (
      <div className="auth-done">
        <p>Verifying your email…</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="auth-done">
        <span className="auth-done-icon">✓</span>
        <p>Email verified successfully! Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="auth-done">
      <p className="auth-error" role="alert">{errorMsg}</p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <Link href="/login" className="btn btn-primary">Sign in</Link>
        <Link href="/" className="btn btn-ghost">Go home</Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="auth-split">
      <div className="auth-split-form">
        <div className="auth-split-inner">
          <Link href="/" className="brand auth-split-logo">
            <span className="brand-dot">C</span>
            Cartivo
          </Link>
          <div className="auth-split-head">
            <h1>Verify your email</h1>
            <p>Confirming your email address…</p>
          </div>
          <Suspense fallback={null}>
            <VerifyEmailForm />
          </Suspense>
        </div>
      </div>
      <AuthPanel />
    </main>
  );
}
