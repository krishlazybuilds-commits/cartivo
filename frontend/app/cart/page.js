"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

import Reveal from "../components/Reveal";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomSelect from "../components/CustomSelect";
import { useCart } from "../lib/cart";
import { CartSkeleton } from "../components/Skeleton";
import { formatPrice } from "../lib/format";
import { fetchShippingEstimate } from "../lib/api";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, item } | null
  const [country, setCountry] = useState("IN");
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const loadEstimate = useCallback(async (c, subtotal) => {
    if (!c || !subtotal) return;
    setEstimating(true);
    const result = await fetchShippingEstimate(c, subtotal);
    setEstimate(result);
    setEstimating(false);
  }, []);

  // Refresh estimate whenever cart total or country changes.
  useEffect(() => {
    if (cart?.total > 0) {
      loadEstimate(country, cart.total);
    } else {
      setEstimate(null);
    }
  }, [cart?.total, country, loadEstimate]);

  async function run(action) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleConfirm() {
    if (!confirm) return;
    const action = confirm.type === "clear"
      ? () => clear()
      : () => removeItem(confirm.item.id);
    setConfirm(null);
    run(action);
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Your cart</span>
                <h2>Shopping cart</h2>
              </div>
            </Reveal>

            {loading && !cart ? (
              <CartSkeleton />
            ) : !cart || cart.items.length === 0 ? (
              <div className="cart-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <p>Your cart is empty.</p>
                <Link href="/products" className="btn btn-primary">Browse the shop</Link>
              </div>
            ) : (
              <div className="cart">
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
                <ul className="cart-items">
                  {cart.items.map((item) => (
                    <li className="cart-item" key={item.id}>
                      <div className="cart-item-info">
                        <strong>{item.product_name}</strong>
                        <span className="product-cat">
                          {formatPrice(item.unit_price)} each
                        </span>
                      </div>
                      <div className="cart-item-qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            run(() =>
                              item.quantity > 1
                                ? updateItem(item.id, item.quantity - 1)
                                : removeItem(item.id)
                            )
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => run(() => updateItem(item.id, item.quantity + 1))}
                        >
                          +
                        </button>
                      </div>
                      <span className="cart-item-subtotal">
                        {formatPrice(item.subtotal)}
                      </span>
                      <button
                        className="cart-item-remove"
                        type="button"
                        onClick={() => setConfirm({ type: "remove", item })}
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="cart-summary">
                  <div className="cart-total">
                    <span>Subtotal</span>
                    <strong>{formatPrice(cart.total)}</strong>
                  </div>

                  {/* Shipping & tax estimate */}
                  <div className="shipping-estimate" style={{ marginTop: "1rem" }}>
                    <label className="shipping-estimate-label">
                      <span>Estimate for</span>
                      <CustomSelect
                        value={country}
                        options={[
                          { value: "IN", label: "India" },
                          { value: "US", label: "United States" },
                          { value: "CA", label: "Canada" },
                          { value: "GB", label: "United Kingdom" },
                          { value: "AU", label: "Australia" },
                          { value: "DE", label: "Germany" },
                          { value: "FR", label: "France" },
                          { value: "OTHER", label: "Other" },
                        ]}
                        onChange={setCountry}
                      />
                    </label>
                    {estimating && <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Calculating…</p>}
                    {!estimating && estimate && (
                      <div style={{ fontSize: "0.875rem", marginTop: "0.5rem", display: "grid", gap: "0.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Shipping</span>
                          <span>{estimate.shipping === 0 ? "Free" : formatPrice(estimate.shipping)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Tax (est.)</span>
                          <span>{formatPrice(estimate.tax)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--border, #ddd)", paddingTop: "0.25rem", marginTop: "0.25rem" }}>
                          <span>Est. total</span>
                          <span>{formatPrice(estimate.total)}</span>
                        </div>
                        <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                          {estimate.note}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="cart-actions" style={{ marginTop: "1rem" }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setConfirm({ type: "clear" })}
                    >
                      Clear cart
                    </button>
                    <Link className="btn btn-primary" href="/checkout">
                      Checkout
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === "clear" ? "Clear your cart?" : "Remove item?"}
        message={
          confirm?.type === "clear"
            ? "This will remove all items from your cart. This can't be undone."
            : `Remove "${confirm?.item?.product_name}" from your cart?`
        }
        confirmLabel={confirm?.type === "clear" ? "Clear cart" : "Remove"}
        destructive
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
