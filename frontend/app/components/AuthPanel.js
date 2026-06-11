import Link from "next/link";

import { API_URL } from "../lib/api";

/**
 * Right-hand decorative panel for all auth pages.
 *
 * Plays a short, looping scenery video as the backdrop with a dark gradient
 * overlay for legibility and the brand mark pinned to the bottom.
 *
 * The video is served by the backend at /api/auth-video/ (a redirect to a
 * configurable source — set AUTH_VIDEO_URL on the backend). Override on the
 * frontend with NEXT_PUBLIC_AUTH_VIDEO_URL if you'd rather point elsewhere
 * (e.g. a file in `frontend/public/`).
 */
const VIDEO_SRC = process.env.NEXT_PUBLIC_AUTH_VIDEO_URL || `${API_URL}/auth-video/`;
const POSTER_SRC = process.env.NEXT_PUBLIC_AUTH_VIDEO_POSTER || "";

export default function AuthPanel() {
  return (
    <div className="auth-panel" aria-hidden="true">
      {/* Background scenery video */}
      <video
        className="auth-panel-video"
        src={VIDEO_SRC}
        poster={POSTER_SRC || undefined}
        width={1920}
        height={1080}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      {/* Dark gradient overlay for text legibility */}
      <div className="auth-panel-overlay" />

      {/* Brand mark pinned to bottom */}
      <div className="auth-panel-brand">
        <Link href="/" className="brand auth-panel-brandmark">
          <span className="brand-dot" style={{ background: "var(--accent)", color: "var(--ink)" }}>C</span>
          <span style={{ color: "#fff" }}>Cartivo</span>
        </Link>
        <p className="auth-panel-tagline">
          Shop the latest tech.<br />Fast checkout. Real products.
        </p>
      </div>
    </div>
  );
}
