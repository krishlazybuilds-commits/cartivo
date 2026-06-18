"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";

import Reveal from "../components/Reveal";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomSelect from "../components/CustomSelect";
import { useCart } from "../lib/cart";
import { CartSkeleton } from "../components/Skeleton";
import { formatPrice } from "../lib/format";
import { useToast } from "../lib/toast";
import { API_URL, fetchShippingEstimate } from "../lib/api";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const toast = useToast();
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, item } | null
  const [country, setCountry] = useState("IN");
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadEstimate = useCallback((c, subtotal) => {
    if (!c || !subtotal) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setEstimating(true);
      try {
        const result = await fetchShippingEstimate(c, subtotal);
        if (result) setEstimate(result);
      } catch (err) {
        toast(err.message || "Couldn't load estimate", "error", 4000);
      }
      setEstimating(false);
    }, 400);
  }, [toast]);

  // Refresh estimate whenever cart total or country changes.
  useEffect(() => {
    if (cart?.total > 0) {
      loadEstimate(country, cart.total);
    } else {
      setEstimate(null);
    }
  }, [cart?.total, country, loadEstimate]);

  // Debug logging for footer flicker investigation
  function logLayout(tag, extra) {
    console.log(`[CART ${tag}]`, {
      loading,
      cartItems: cart?.items?.length,
      cartTotal: cart?.total,
      estimating,
      hasEstimate: !!estimate,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      ...extra,
    });
  }

  useEffect(() => {
    logLayout("loading=" + loading);
  }, [loading]);

  useEffect(() => {
    if (cart) logLayout("cart updated");
  }, [cart]);

  useEffect(() => {
    logLayout("estimating=" + estimating, { estimateNote: estimate?.note });
  }, [estimating]);

  useEffect(() => {
    if (estimate) logLayout("estimate received");
  }, [estimate]);

  // Log the rendering path
  const showSkeleton = loading && !cart;
  const showEmpty = !cart || cart.items.length === 0;
  const showCart = !showSkeleton && !showEmpty;
  useEffect(() => {
    logLayout("render path", { showSkeleton, showEmpty, showCart });
  }, [showSkeleton, showEmpty, showCart]);

  // Measure actual estimate container height
  useEffect(() => {
    const el = document.querySelector(".shipping-estimate");
    if (el) {
      const rect = el.getBoundingClientRect();
      console.log(`[CART estimate-height] ${rect.height}px`, { estimating, hasEstimate: !!estimate });
    }
  }, [estimating, estimate, cart?.total]);

  async function run(action) {
    logLayout("before-update");
    setError(null);
    try {
      await action();
      logLayout("after-update");
    } catch (err) {
      setError(err.message);
      logLayout("error");
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

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/coupons/validate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal: cart?.total ?? 0 }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponData(data);
      } else {
        setError(data.message || "Invalid coupon code.");
        setCouponData(null);
      }
    } catch {
      setError("Failed to validate coupon.");
    } finally {
      setValidatingCoupon(false);
    }
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
                          onClick={() => {
                            console.log("[CART] qty-", { id: item.id, from: item.quantity, to: item.quantity - 1 });
                            run(() =>
                              item.quantity > 1
                                ? updateItem(item.id, item.quantity - 1)
                                : removeItem(item.id)
                            );
                          }}
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => {
                            console.log("[CART] qty+", { id: item.id, from: item.quantity, to: item.quantity + 1 });
                            run(() => updateItem(item.id, item.quantity + 1));
                          }}
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
                  <div className="shipping-estimate" style={{ marginTop: "1rem", minHeight: cart?.total > 0 ? "120px" : undefined }}>
                    <label className="shipping-estimate-label">
                      <span>Estimate for{estimating ? " (calculating…)" : ""}</span>
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
                    {estimate && (
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

                  {couponData && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success, #16a34a)", fontSize: "0.875rem" }}>
                      <span>Discount ({couponData.code})</span>
                      <span>-{formatPrice(couponData.discount_amount)}</span>
                    </div>
                  )}

                  <div className="coupon-field" style={{ marginTop: "1rem" }}>
                    <label style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>Coupon code</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Enter code"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponCode.trim()}
                        style={{ padding: "0 1.5rem" }}
                      >
                        {validatingCoupon ? "…" : "Apply"}
                      </button>
                    </div>
                    {couponData && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--success, #16a34a)" }}>
                        {couponData.message}
                      </p>
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
