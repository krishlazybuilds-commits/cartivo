"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
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
      router.push(searchParams.get("next") || "/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container auth-wrap">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Welcome back</span>
                <h2>Sign in</h2>
              </div>
            </Reveal>
            <Reveal delay={80}>
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>
              <p className="auth-alt">
                No account? <Link href="/register">Create one</Link>
              </p>
              <p className="auth-alt">
                <Link href="/forgot-password">Forgot password?</Link>
              </p>
            </form>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
