"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form;
      await register(payload);
      router.push("/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container auth-wrap">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Get started</span>
                <h2>Create your account</h2>
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
                  value={form.username}
                  onChange={update("username")}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  autoComplete="email"
                />
              </label>
              <div className="auth-row">
                <label>
                  First name
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={update("first_name")}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={update("last_name")}
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={update("password")}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Creating account…" : "Create account"}
              </button>
              <p className="auth-alt">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </form>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
