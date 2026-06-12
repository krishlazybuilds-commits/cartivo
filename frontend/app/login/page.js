"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import AuthBackButton from "../components/AuthBackButton";
import PasswordInput from "../components/PasswordInput";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      toast("Signed in successfully", "success");
      router.push(searchParams.get("next") || "/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label>
        Username
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        Password
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <div className="auth-divider"><span>or</span></div>
      <GoogleButton action="Sign in" next={searchParams.get("next") || "/products"} />
      <p className="auth-alt">No account? <Link href="/register">Create one</Link></p>
      <p className="auth-alt"><Link href="/forgot-password">Forgot password?</Link></p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-split">
      {/* Left — form */}
      <div className="auth-split-form">
        <div className="auth-split-inner">
          <AuthBackButton />
          <div className="auth-split-head">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue.</p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>

      {/* Right — visual panel */}
      <Suspense fallback={<div className="auth-panel" />}>
        <AuthPanel />
      </Suspense>
    </main>
  );
}
