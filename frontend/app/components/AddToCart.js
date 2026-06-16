"use client";

import { useState } from "react";

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
              <svg width="12" height="2" viewBox="0 0 12 2" fill="none" aria-hidden="true"><rect width="12" height="2" rx="1" fill="currentColor"/></svg>
            </button>
            <span className="qty-value" aria-live="polite" aria-label={`Quantity: ${quantity}`}>{quantity}</span>
            <button type="button" className="qty-btn" onClick={() => setQuantity((q) => Math.min(q + 1, effectiveStock))} aria-label="Increase quantity">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><rect x="5" width="2" height="12" rx="1" fill="currentColor"/><rect y="5" width="12" height="2" rx="1" fill="currentColor"/></svg>
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!canAdd || addStatus === "adding"}
            type="button"
          >
            {addStatus === "adding" ? "Adding…" : addStatus === "added" ? "Added ✓" : "Add to cart"}
          </button>
        </>
      )}
    </div>
  );
}
