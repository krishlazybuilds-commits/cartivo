"use client";

import { useEffect } from "react";

/*
 * Drives the rolling counter via requestAnimationFrame and handles cleanup
 * after the strip-exit animation finishes.
 * The overlay HTML lives in layout.js (server-rendered) so it covers the
 * page from byte 1.
 *
 * Route prefetching has been moved to PrefetchRoutes.js so it runs on every
 * page load via requestIdleCallback, not just during the landing animation.
 */
export default function LandingIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-intro") !== "play") return;

    // ── Rolling counter 0 → 100 ──────────────────────────────────────────────
    const counterEl = document.getElementById("li-counter-num");
    if (counterEl) {
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        counterEl.textContent = Math.round(eased * 100);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ── Cleanup after strips finish sliding out ──────────────────────────────
    const finish = () => root.setAttribute("data-intro", "done");
    const timer = setTimeout(finish, 3800);
    const skip = () => { clearTimeout(timer); finish(); };
    window.addEventListener("keydown", skip, { once: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return null;
}
