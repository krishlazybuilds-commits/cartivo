"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

import Reveal from "../components/Reveal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useCart } from "../lib/cart";
import { CartSkeleton } from "../components/Skeleton";
import { formatPrice } from "../lib/format";
import { fetchShippingEstimate } from "../lib/api";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, item } | null
  const [country, setCountry] = useState("US");
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
              <p className="center">
                Your cart is empty. <Link href="/products">Browse the shop</Link>.
              </p>
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
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
                      <span>Estimate for</span>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        style={{ padding: "0.2rem 0.4rem", borderRadius: 4, border: "1px solid var(--border, #ddd)" }}
                        aria-label="Select country for shipping estimate"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="OTHER">Other</option>
                      </select>
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
