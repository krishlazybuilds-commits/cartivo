/**
 * Read-only star rating display. Pure component (no hooks) so it can be used
 * in both server and client components. Renders a fractional fill via an
 * absolutely-positioned overlay clipped to `value / 5`.
 */
export default function StarRating({ value = 0, count, size = "1rem", showCount = true }) {
  const safe = Number(value) || 0;
  const pct = Math.max(0, Math.min(100, (safe / 5) * 100));

  return (
    <span
      className="star-rating"
      style={{ fontSize: size }}
      aria-label={`Rated ${safe.toFixed(1)} out of 5`}
    >
      <span className="star-rating-stars">
        <span className="star-rating-empty" aria-hidden="true">
          ★★★★★
        </span>
        <span className="star-rating-fill" style={{ width: `${pct}%` }} aria-hidden="true">
          ★★★★★
        </span>
      </span>
      {showCount && typeof count === "number" && (
        <span className="star-rating-count">
          {count > 0 ? `${safe.toFixed(1)} (${count})` : "No reviews"}
        </span>
      )}
    </span>
  );
}
