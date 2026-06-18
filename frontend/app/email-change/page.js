"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import { authFetch, extractError } from "../lib/auth";

function EmailChangeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailUid = searchParams.get("email_uid") || "";
  const emailToken = searchParams.get("email_token") || "";

  const [status, setStatus] = useState("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!emailUid || !emailToken) {
      setStatus("error");
      setErrorMsg("Invalid confirmation link.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await authFetch("/auth/me/email/confirm/", {
          method: "POST",
          body: JSON.stringify({ uid: emailUid, token: emailToken }),
        });
        if (cancelled) return;
        setStatus("done");
        setTimeout(() => router.push("/profile"), 2500);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(extractError(err.data, err.message));
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [emailUid, emailToken, router]);

  if (status === "verifying") {
    return (
      <div className="auth-done">
        <p>Verifying your new email address…</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="auth-done">
        <span className="auth-done-icon">✓</span>
        <p>Email updated successfully! Redirecting to your profile…</p>
      </div>
    );
  }

  return (
    <div className="auth-done">
      <p className="auth-error" role="alert">{errorMsg}</p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <Link href="/login" className="btn btn-primary">Sign in</Link>
        <Link href="/profile" className="btn btn-ghost">Go to profile</Link>
      </div>
    </div>
  );
}

export default function EmailChangePage() {
  return (
    <main className="auth-split">
      <div className="auth-split-form">
        <div className="auth-split-inner">
          <Link href="/" className="brand auth-split-logo">
            <span className="brand-dot">C</span>
            Cartivo
          </Link>
          <div className="auth-split-head">
            <h1>Confirm email change</h1>
            <p>Confirming your new email address…</p>
          </div>
          <Suspense fallback={null}>
            <EmailChangeForm />
          </Suspense>
        </div>
      </div>
      <AuthPanel />
    </main>
  );
}
