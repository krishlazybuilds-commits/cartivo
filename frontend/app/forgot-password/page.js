"use client";

import { useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { API_URL } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // "sending" | "done" | "error"

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
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
                <span className="eyebrow">Account recovery</span>
                <h2>Forgot password</h2>
                <p>Enter your email and we&apos;ll send you a reset link.</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
            {status === "done" ? (
              <p style={{ textAlign: "center" }}>
                Check your inbox — a reset link is on its way.<br />
                <Link href="/login">Back to sign in</Link>
              </p>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                {status === "error" && (
                  <p className="auth-error" role="alert">Something went wrong. Please try again.</p>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Send reset link"}
                </button>
                <p className="auth-alt">
                  Remembered it? <Link href="/login">Sign in</Link>
                </p>
              </form>
            )}
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
