"use client";

import { useState } from "react";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import AuthBackButton from "../components/AuthBackButton";
import { API_URL } from "../lib/api";
import { ensureCsrfToken } from "../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      const csrf = await ensureCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrf) headers["X-CSRFToken"] = csrf;

      const res = await fetch(`${API_URL}/auth/password-reset/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="auth-split">
      {/* Left — form */}
      <div className="auth-split-form">
        <div className="auth-split-inner">
          <AuthBackButton />
          <div className="auth-split-head">
            <h1>Forgot password?</h1>
            <p>Enter your email and we&apos;ll send you a reset link.</p>
          </div>

          {status === "done" ? (
            <div className="auth-done">
              <span className="auth-done-icon">✓</span>
              <p>Check your inbox — a reset link is on its way.</p>
              <Link href="/login" className="btn btn-ghost" style={{ marginTop: "1rem" }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {status === "error" && (
                <p className="auth-error" role="alert">Something went wrong. Please try again.</p>
              )}
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send reset link"}
              </button>
              <p className="auth-alt">Remembered it? <Link href="/login">Sign in</Link></p>
            </form>
          )}
        </div>
      </div>

      {/* Right — visual panel */}
      <AuthPanel />
    </main>
  );
}
