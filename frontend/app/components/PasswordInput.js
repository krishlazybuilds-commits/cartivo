"use client";

import { useState } from "react";

function EyeIcon({ open }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s ease", transform: open ? "scale(1)" : "scale(0.9)" }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style={{ opacity: open ? 1 : 0, transition: "opacity 0.2s ease" }} />
      <circle cx="12" cy="12" r="3" style={{ opacity: open ? 1 : 0, transition: "opacity 0.2s ease" }} />
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
      <line x1="1" y1="1" x2="23" y2="23" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
    </svg>
  );
}

export default function PasswordInput({ value, onChange, autoComplete, required, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-password-wrap">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} required={required} minLength={minLength} />
      <button type="button" className="auth-password-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        <EyeIcon open={show} />
      </button>
    </div>
  );
}
