"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { authFetch } from "../lib/auth";
import { API_URL, fetchShippingEstimate } from "../lib/api";
import { formatPrice } from "../lib/format";

const EMPTY = {
  shipping_full_name: "",
  shipping_address: "",
  shipping_city: "",
  shipping_postal_code: "",
  shipping_country: "US",
};

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Checkout requires an account. Send guests to sign in (and back here after).
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Refresh estimate when country or cart total changes.
  const loadEstimate = useCallback(async () => {
    if (!cart?.total || !form.shipping_country) return;
    const result = await fetchShippingEstimate(form.shipping_country, cart.total);
    setEstimate(result);
  }, [cart?.total, form.shipping_country]);

  useEffect(() => {
    loadEstimate();
  }, [loadEstimate]);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/coupons/validate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal: cart.total }),
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let order;
    try {
      order = await authFetch("/orders/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          coupon_code: couponData ? couponData.code : "",
        }),
      });
      await refresh();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    // Redirect to Stripe Checkout.
    try {
      const { url } = await authFetch(`/orders/${order.id}/pay/`, { method: "POST" });
      window.location.href = url;
    } catch {
      // Order created but payment couldn't start — let user retry from order page.
      router.push(`/orders/${order.id}`);
    }
  }

  if (authLoading || !user) return null;

  const isEmpty = !cart || cart.items.length === 0;
  const finalTotal = estimate ? (estimate.total - (couponData?.discount_amount || 0)) : cart.total;

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Checkout</span>
                <h2>Shipping &amp; payment</h2>
              </div>
            </Reveal>

            {isEmpty ? (
              <p className="center">
                Your cart is empty. <Link href="/products">Browse the shop</Link>.
              </p>
            ) : (
              <div className="checkout">
                <form className="auth-form checkout-form" onSubmit={handleSubmit}>
                  {error && (
                    <p className="auth-error" role="alert">
                      {error}
                    </p>
                  )}

                  <label>
                    Full name
                    <input type="text" value={form.shipping_full_name} onChange={update("shipping_full_name")} required />
                  </label>
                  <label>
                    Address
                    <input type="text" value={form.shipping_address} onChange={update("shipping_address")} required />
                  </label>
                  <div className="auth-row">
                    <label>
                      City
                      <input type="text" value={form.shipping_city} onChange={update("shipping_city")} required />
                    </label>
                    <label>
                      Postal code
                      <input type="text" value={form.shipping_postal_code} onChange={update("shipping_postal_code")} required />
                    </label>
                  </div>
                  <label>
                    Country
                    <select value={form.shipping_country} onChange={update("shipping_country")} required>
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>

                  <div className="coupon-field" style={{ marginTop: "1rem" }}>
                    <label style={{ marginBottom: "0.5rem" }}>Coupon code</label>
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

                  <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: "1.5rem" }}>
                    {submitting ? "Redirecting to payment…" : `Pay · ${formatPrice(finalTotal)}`}
                  </button>
                </form>

                <aside className="checkout-summary">
                  <h3>Order summary</h3>
                  <ul>
                    {cart.items.map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.quantity} × {item.product_name}
                        </span>
                        <span>{formatPrice(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="cart-total" style={{ marginTop: "0.75rem" }}>
                    <span>Subtotal</span>
                    <strong>{formatPrice(cart.total)}</strong>
                  </div>

                  <div style={{ fontSize: "0.875rem", marginTop: "0.5rem", display: "grid", gap: "0.2rem" }}>
                    {couponData && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success, #16a34a)" }}>
                        <span>Discount ({couponData.code})</span>
                        <span>-{formatPrice(couponData.discount_amount)}</span>
                      </div>
                    )}
                    {estimate && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Shipping</span>
                          <span>{estimate.shipping === 0 ? "Free" : formatPrice(estimate.shipping)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Tax (est.)</span>
                          <span>{formatPrice(estimate.tax)}</span>
                        </div>
                      </>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--line)", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
                      <span>Total</span>
                      <span>{formatPrice(finalTotal)}</span>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
