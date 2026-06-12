"use client";

import { useEffect } from "react";

/**
 * Direct-load reveal for the auth pages.
 *
 * The in-app page transition (TransitionProvider) only fires on link clicks, so
 * landing on /login, /register, etc. via a typed URL or refresh would skip the
 * reveal. An inline script in the root layout sets data-auth-intro="play" before
 * first paint (flash-free) and renders the covering strips. This component holds
 * the title, then uncovers — matching the in-app transition feel.
 */
const AUTH_TITLES = {
  "/login": "Sign in",
  "/register": "Get started",
  "/forgot-password": "Reset password",
  "/reset-password": "Reset password",
};

// Match the in-app transition timing (TransitionProvider).
const TITLE_HOLD_MS = 900;
const UNCOVER_DONE_MS = 1100;

export default function AuthIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-auth-intro") !== "play") return undefined;

    const overlay = document.querySelector(".auth-intro");
    const word = document.getElementById("auth-intro-word");
    const title = AUTH_TITLES[window.location.pathname] || "Cartivo";

    // Build the clip-rising letters (identical markup to the in-app transition).
    if (word) {
      word.innerHTML = "";
      title.split("").forEach((ch, i) => {
        const wrap = document.createElement("span");
        wrap.className = "pt-letter-wrap";
        const letter = document.createElement("span");
        letter.className = "pt-letter";
        letter.style.animationDelay = `${0.05 + i * 0.055}s`;
        letter.textContent = ch === " " ? "\u00A0" : ch;
        wrap.appendChild(letter);
        word.appendChild(wrap);
      });
    }

    let doneTimer;
    const uncoverTimer = setTimeout(() => {
      overlay?.classList.add("auth-intro--uncovering");
      doneTimer = setTimeout(() => {
        root.setAttribute("data-auth-intro", "done");
      }, UNCOVER_DONE_MS);
    }, TITLE_HOLD_MS);

    return () => {
      clearTimeout(uncoverTimer);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, []);

  return null;
}
