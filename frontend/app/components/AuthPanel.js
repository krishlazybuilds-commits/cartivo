/**
 * Right-hand decorative panel for all auth pages.
 *
 * Plays a short, looping scenery video as the backdrop with a dark gradient
 * overlay for legibility and the brand mark pinned to the bottom.
 *
 * Defaults to the bundled space clip in `frontend/public/space-loop.mp4`.
 * Override with NEXT_PUBLIC_AUTH_VIDEO_URL to point elsewhere (e.g. the backend
 * redirect at `${API_URL}/auth-video/`, configured via AUTH_VIDEO_URL).
 */
const VIDEO_SRC = process.env.NEXT_PUBLIC_AUTH_VIDEO_URL || "/space-loop.mp4";
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

      {/* Designer quote pinned to bottom */}
      <div className="auth-panel-brand">
        <p className="auth-panel-quote">&ldquo;Why space in an e-commerce app?&rdquo;</p>
        <p className="auth-panel-tagline">Because the developer loves space.</p>
      </div>
    </div>
  );
}
