"use client";

import { useWishlist } from "../lib/wishlist";

function HeartIcon({ filled }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

export default function WishlistButton({ productId, withLabel = false, className = "" }) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggle(productId);
  }

  return (
    <button
      type="button"
      className={`wishlist-btn${active ? " active" : ""}${withLabel ? " with-label" : ""} ${className}`.trim()}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from wishlist" : "Save to wishlist"}
    >
      <HeartIcon filled={active} />
      {withLabel && <span>{active ? "Saved" : "Save"}</span>}
    </button>
  );
}
