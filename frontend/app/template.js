/**
 * Root template — unlike layout.js, this re-mounts on every navigation, so it's
 * the natural place for an "enter" page transition. The animation is pure CSS
 * (.page-transition in globals.css), so this stays a server component; the
 * keyframe is disabled under prefers-reduced-motion.
 */
export default function Template({ children }) {
  return <div className="page-transition">{children}</div>;
}
