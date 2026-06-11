"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Prefetches all key routes once per session when the browser is idle,
 * regardless of which page the user lands on first.
 *
 * Uses requestIdleCallback so it never competes with the current page's
 * rendering or user interaction. Falls back to a plain setTimeout on
 * browsers that don't support requestIdleCallback (Safari < 16).
 *
 * Marked in sessionStorage so it only runs once per session — subsequent
 * page navigations within the same tab skip it entirely.
 */

const ROUTES = [
  "/products",
  "/categories",
  "/cart",
  "/login",
  "/register",
  "/orders",
  "/wishlist",
  "/checkout",
  "/profile",
];

const SESSION_KEY = "cartivo_prefetched";

export default function PrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    // Already prefetched this session — skip
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const run = () => {
      // Stagger each prefetch 150ms apart so they don't all fire at once
      ROUTES.forEach((path, i) => {
        setTimeout(() => router.prefetch(path), i * 150);
      });
      sessionStorage.setItem(SESSION_KEY, "1");
    };

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback: wait 2s after mount (page is likely interactive by then)
      const t = setTimeout(run, 2000);
      return () => clearTimeout(t);
    }
  }, [router]);

  return null;
}
