"use client";

import { useWishlist } from "../lib/wishlist";

/**
 * Heart toggle that adds/removes a product from the user's wishlist.
 * Set `withLabel` for the labelled variant (product detail page); leave it off
 * for the compact icon-only variant used on product cards.
 */
export default function WishlistButton({ productId, withLabel = false, className = "" }) {
  const { isWishlisted, toggle } = useWishlist();
  const active = isWishlisted(productId);

  function handleClick(e) {
    // Product cards wrap the button in a <Link>; stop the click from
    // navigating to the product page.
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
      <span className="wishlist-heart" aria-hidden="true">
        {active ? "♥" : "♡"}
      </span>
      {withLabel && <span>{active ? "Saved" : "Save"}</span>}
    </button>
  );
}
