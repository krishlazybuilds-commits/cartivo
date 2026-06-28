"use client";

import { useState } from "react";
import { API_URL } from "../lib/api";
import { useToast } from "../lib/toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast("Please enter a valid email address.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/newsletter/subscribe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 201) {
        toast(data.detail || "Subscription failed. Please try again.", "error");
      } else {
        toast("You're on the list! We'll be in touch.", "success");
        setEmail("");
      }
    } catch {
      toast("Subscription failed. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
      <div className="newsletter-field">
        <span className="newsletter-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 4-10 8L2 4" />
          </svg>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
          disabled={submitting}
        />
        <button type="submit" className="newsletter-btn" disabled={submitting}>
          {submitting ? (
            <span className="newsletter-spinner" aria-hidden="true" />
          ) : (
            <>
              Subscribe
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
