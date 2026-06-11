"use client";

import { useRouter } from "next/navigation";

export default function AuthBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="auth-back"
      onClick={() => router.push("/")}
      aria-label="Go back"
    >
      <svg className="auth-back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
