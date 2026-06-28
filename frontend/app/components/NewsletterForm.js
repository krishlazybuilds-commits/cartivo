"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "../lib/toast";
import { ensureCsrfToken } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const toast = useToast();
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast("Please enter a valid email address.", "error");
      return;
    }
    setStatus("loading");
    try {
      const csrf = await ensureCsrfToken();
      const headers = { "Content-Type": "application/json" };
      if (csrf) headers["X-CSRFToken"] = csrf;
      const res = await fetch(`/api/v1/newsletter/subscribe/`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 201) {
        toast(data.detail || "Subscription failed. Please try again.", "error");
        setStatus("idle");
      } else {
        setStatus("success");
        toast("You're on the list! We'll be in touch.", "success");
        timerRef.current = setTimeout(() => {
          setEmail("");
          setStatus("idle");
        }, 2800);
      }
    } catch {
      toast("Subscription failed. Please try again.", "error");
      setStatus("idle");
    }
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
      <div className={`newsletter-field${isSuccess ? " newsletter-field--success" : ""}`}>
        <span className="newsletter-icon" aria-hidden="true">
          {isSuccess ? (
            <svg className="newsletter-checkmark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path className="newsletter-checkmark-path" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 4-10 8L2 4" />
            </svg>
          )}
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
          disabled={isLoading || isSuccess}
        />
        <button
          type="submit"
          className={`newsletter-btn${isLoading ? " newsletter-btn--loading" : ""}${isSuccess ? " newsletter-btn--success" : ""}`}
          disabled={isLoading || isSuccess}
        >
          <span className="newsletter-btn-text">
            {isSuccess ? "Sent!" : "Subscribe"}
          </span>
          {isLoading && (
            <span className="newsletter-dots" aria-hidden="true">
              <span className="newsletter-dot" />
              <span className="newsletter-dot" />
              <span className="newsletter-dot" />
            </span>
          )}
          {isSuccess && (
            <svg className="newsletter-btn-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="newsletter-btn-check-path" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {!isLoading && !isSuccess && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
