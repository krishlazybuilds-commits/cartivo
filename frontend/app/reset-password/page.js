"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { API_URL } from "../lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null); // "submitting" | "done" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/confirm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail || "Invalid or expired link.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p style={{ textAlign: "center" }}>
        Password updated! Redirecting to <Link href="/login">sign in</Link>…
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {status === "error" && (
        <p className="auth-error" role="alert">{errorMsg}</p>
      )}
      <label>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container auth-wrap">
            <div className="section-head center">
              <span className="eyebrow">Account recovery</span>
              <h2>Set new password</h2>
            </div>
            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
