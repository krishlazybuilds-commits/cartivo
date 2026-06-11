"use client";

/**
 * Root template — unlike layout.js, this re-mounts on every navigation, so it's
 * the natural place for an "enter" page transition. The actual animation lives
 * in globals.css (.page-transition) and is disabled under prefers-reduced-motion.
 */
export default function Template({ children }) {
  return <div className="page-transition">{children}</div>;
}
