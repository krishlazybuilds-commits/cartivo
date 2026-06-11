"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Footer newsletter signup. Validates the email client-side and shows a
 * confirmation state. NOTE: there is no newsletter backend yet — wire this to
 * a real subscribe endpoint when one exists.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setDone(true);
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
        />
        <button type="submit" className="btn btn-primary">
          Subscribe
        </button>
      </div>
      {error && <span className="newsletter-error">{error}</span>}
    </form>
  );
}
