"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cartivo-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't already made a choice.
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (e.g. privacy mode) — don't block the UI.
    }
  }, []);

  function choose(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p className="cookie-consent-text">
        We use cookies to keep you signed in and improve your experience. See our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <div className="cookie-consent-actions">
        <button type="button" className="btn btn-ghost" onClick={() => choose("declined")}>
          Decline
        </button>
        <button type="button" className="btn btn-primary" onClick={() => choose("accepted")}>
          Accept
        </button>
      </div>
    </div>
  );
}
