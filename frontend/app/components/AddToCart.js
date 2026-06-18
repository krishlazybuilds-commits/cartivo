"use client";

import { useState } from "react";
import Link from "next/link";

import { useCart } from "../lib/cart";
import { useToast } from "../lib/toast";

export default function AddToCart({ productId, productName, productPrice, inStock, variants = [] }) {
  const { addItem } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(
    variants.length === 1 ? variants[0].id : null
  );
  const [addStatus, setAddStatus] = useState("idle");
  const [hasAdded, setHasAdded] = useState(false);

  const activeVariants = variants.filter((v) => v.is_active);
  const selectedVariant = activeVariants.find((v) => v.id === variantId) ?? null;

  // Effective stock / price for the current selection
  const effectiveStock = selectedVariant ? selectedVariant.stock : (activeVariants.length === 0 ? Infinity : 0);
  const effectivePrice = selectedVariant
    ? (selectedVariant.price ?? productPrice)
    : productPrice;
  const hasVariants = activeVariants.length > 0;
  const canAdd = inStock && (!hasVariants || selectedVariant) && effectiveStock > 0;

  async function handleAdd() {
    if (hasVariants && !selectedVariant) {
      toast("Please select an option first", "error");
      return;
    }
    setAddStatus("adding");
    try {
      await addItem(productId, quantity, {
        name: productName,
        price: effectivePrice,
        variantId: selectedVariant?.id ?? null,
      });
      setAddStatus("added");
      setHasAdded(true);
      toast(`Added ${quantity} to cart`, "success");
      setTimeout(() => setAddStatus("idle"), 2000);
    } catch (err) {
      setAddStatus("error");
      toast(err.message || "Couldn't add to cart", "error");
    }
  }

  return (
    <div className="add-to-cart">
      {hasVariants && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {activeVariants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`btn btn-ghost${variantId === v.id ? " active" : ""}`}
              style={{
                opacity: v.stock === 0 ? 0.4 : 1,
                fontWeight: variantId === v.id ? 700 : undefined,
                outline: variantId === v.id ? "2px solid var(--accent, #000)" : undefined,
              }}
              disabled={v.stock === 0}
              onClick={() => setVariantId(v.id)}
              aria-pressed={variantId === v.id}
            >
              {v.name}
              {v.price !== null && v.price !== productPrice && (
                <span style={{ marginLeft: "0.4em", fontSize: "0.85em", opacity: 0.7 }}>
                  ${Number(v.price).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!canAdd && !hasVariants ? (
        <button className="btn btn-ghost" disabled type="button">Out of stock</button>
      ) : (
        <>
          <div className="qty-selector">
            <button type="button" className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">
              <svg width="10" height="2" viewBox="0 0 10 2" fill="none" aria-hidden="true"><rect width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>
            </button>
            <span className="qty-value" aria-live="polite" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
            <button type="button" className="qty-btn" onClick={() => setQuantity((q) => Math.min(q + 1, effectiveStock))} aria-label="Increase quantity">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x="4.25" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect y="4.25" width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!canAdd || addStatus === "adding"}
            type="button"
          >
            <span className={`atc-content${addStatus === "adding" ? " adding" : ""}${addStatus === "added" ? " added" : ""}`}>
              {addStatus === "adding" ? (
                <span className="atc-spinner" aria-hidden="true" />
              ) : addStatus === "added" ? (
                <svg className="atc-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg className="atc-cart-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              )}
              <span className="atc-label">
                {addStatus === "adding" ? "Adding" : addStatus === "added" ? "Added" : "Add to cart"}
              </span>
            </span>
          </button>
          {hasAdded && (
            <Link
              href="/products"
              className="btn btn-ghost"
              style={{ marginTop: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              Continue shopping
            </Link>
          )}
        </>
      )}
    </div>
  );
}
