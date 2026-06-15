"use client";

import { useState } from "react";
import { API_URL } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/newsletter/subscribe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 201) {
        setError(data.detail || "Subscription failed. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Subscription failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="newsletter-done" role="status">
        ✓ You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
      <div className="newsletter-field">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          aria-label="Email address"
          aria-invalid={!!error}
          disabled={submitting}
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "…" : "Subscribe"}
        </button>
      </div>
      {error && <span className="newsletter-error">{error}</span>}
    </form>
  );
}
