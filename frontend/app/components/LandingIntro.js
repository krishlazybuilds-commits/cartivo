"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/*
 * Drives the rolling counter via requestAnimationFrame, prefetches the most
 * common routes while the intro animation plays (using the ~2.5s window as
 * free loading time), and handles cleanup after the strips exit.
 * The overlay HTML lives in layout.js (server-rendered) so it covers the
 * page from byte 1.
 */

// Routes to prefetch while the intro plays, in priority order.
// Staggered so requests don't all fire simultaneously.
const PREFETCH_ROUTES = [
  { path: "/products",   delay: 200  },
  { path: "/cart",       delay: 600  },
  { path: "/login",      delay: 1000 },
  { path: "/register",   delay: 1400 },
  { path: "/categories", delay: 1800 },
];

export default function LandingIntro() {
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-intro") !== "play") return;

    // ── Prefetch key routes during the animation window ──────────────────────
    const prefetchTimers = PREFETCH_ROUTES.map(({ path, delay }) =>
      setTimeout(() => router.prefetch(path), delay)
    );

    // ── Rolling counter 0 → 100 ──────────────────────────────────────────────
    const counterEl = document.getElementById("li-counter-num");
    if (counterEl) {
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        counterEl.textContent = Math.floor(eased * 100);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ── Cleanup after strips finish sliding out ──────────────────────────────
    const finish = () => root.setAttribute("data-intro", "done");
    const timer = setTimeout(finish, 3200);
    const skip = () => { clearTimeout(timer); finish(); };
    window.addEventListener("keydown", skip, { once: true });

    return () => {
      prefetchTimers.forEach(clearTimeout);
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [router]);

  return null;
}
