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
import { authFetch } from "../lib/auth";
import CouponInput from "../components/CouponInput";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const toast = useToast();
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type, item } | null
  const [country, setCountry] = useState("IN");
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [couponData, setCouponData] = useState(null);
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

  const showSkeleton = loading && !cart;
  const showEmpty = !cart || cart.items.length === 0;
  const showCart = !showSkeleton && !showEmpty;

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
                      <div className="cart-item-image" style={{ width: "60px", height: "60px", borderRadius: "6px", backgroundColor: "var(--bg-card, #f9fafb)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line, rgba(0, 0, 0, 0.08))", flexShrink: 0 }}>
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        )}
                      </div>
                      <div className="cart-item-info">
                        <strong>{item.product_name}</strong>
                        <span className="product-cat">
                          {formatPrice(item.unit_price)} each
                          {item.price_is_estimate ? " (est.)" : ""}
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

                  <CouponInput
                    subtotal={cart?.total ?? 0}
                    couponData={couponData}
                    onApply={setCouponData}
                    onError={setError}
                  />

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
