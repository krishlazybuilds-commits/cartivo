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
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);

  // Load saved addresses for authenticated users.
  useEffect(() => {
    if (!user) return;
    authFetch("/auth/addresses/")
      .then((data) => setSavedAddresses(data.results ?? data))
      .catch(() => {});
  }, [user]);

  // For guests, validate localStorage prices against the server on mount.
  // This ensures displayed line items reflect real product prices even if
  // localStorage was tampered with or prices changed since the item was added.
  useEffect(() => {
    if (user || !cart || cart.items.length === 0) return;
    const guestItems = cart.items;
    const productIds = [...new Set(guestItems.map((i) => i.product_id))];
    if (productIds.length === 0) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/products/?ids=${productIds.join(",")}&page_size=100`);
        if (!res.ok) return;
        const data = await res.json();
        const products = data.results ?? data;
        const priceMap = {};
        for (const p of products) {
          priceMap[p.id] = parseFloat(p.price);
          if (p.variants) {
            for (const v of p.variants) {
              priceMap[`${p.id}-${v.id}`] = parseFloat(v.effective_price ?? v.price ?? p.price);
            }
          }
        }
        // Update localStorage prices if they differ.
        let changed = false;
        const updatedItems = guestItems.map((item) => {
          const key = item.variant_id ? `${item.product_id}-${item.variant_id}` : item.product_id;
          const serverPrice = priceMap[key];
          if (serverPrice !== undefined && serverPrice !== item.unit_price) {
            changed = true;
            return { ...item, unit_price: serverPrice, subtotal: serverPrice * item.quantity };
          }
          return item;
        });
        if (changed) {
          localStorage.setItem("cartivo_guest_cart", JSON.stringify(updatedItems));
          refresh();
        }
      } catch {
        // Non-critical: worst case we show stale prices, backend still charges correctly.
      }
    })();
  }, [user, cart, refresh]);

  function fillFromAddress(addr) {
    setForm({
      shipping_full_name: addr.full_name,
      shipping_address: addr.address,
      shipping_city: addr.city,
      shipping_postal_code: addr.postal_code,
      shipping_country: addr.country,
    });
  }

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Refresh estimate when country or cart total changes.
  const cartTotal = cart?.total;
  const loadEstimate = useCallback(async () => {
    if (!cartTotal || !form.shipping_country) return;
    const result = await fetchShippingEstimate(form.shipping_country, cartTotal);
    setEstimate(result);
  }, [cartTotal, form.shipping_country]);

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
        body: JSON.stringify({ code: couponCode, subtotal: cartTotal }),
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

    try {
      if (user) {
        // Authenticated: create order from server-side cart, then get pay URL.
        const order = await authFetch("/orders/", {
          method: "POST",
          body: JSON.stringify({ ...form, coupon_code: couponData?.code ?? "" }),
        });
        await refresh();
        const { url } = await authFetch(`/orders/${order.id}/pay/`, { method: "POST" });
        window.location.href = url;
      } else {
        // Guest: submit cart items directly in the request body.
        if (!guestEmail.trim()) {
          setError("Please enter your email address.");
          setSubmitting(false);
          return;
        }
        const items = (cart?.items ?? []).map((i) => ({
          product_id: i.product_id ?? i.product,
          quantity: i.quantity,
          variant_id: i.variant_id ?? null,
        }));
        if (items.length === 0) {
          setError("Your cart is empty.");
          setSubmitting(false);
          return;
        }
        const res = await fetch(`${API_URL}/orders/guest-checkout/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            guest_email: guestEmail.trim(),
            items,
            coupon_code: couponData?.code ?? "",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail || "Checkout failed.");
          setSubmitting(false);
          return;
        }
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  // Wait for auth to resolve before rendering so we don't flash the wrong form state.
  if (authLoading) return null;

  const isEmpty = !cart || cart.items.length === 0;
  const finalTotal = estimate
    ? estimate.total - (couponData?.discount_amount || 0)
    : (cartTotal ?? 0);

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

                  {!user && (
                    <>
                      <label>
                        Email address
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                        />
                      </label>
                      <p style={{ fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem", opacity: 0.6 }}>
                        Your order confirmation will be sent here.{" "}
                        <Link href={`/login?next=/checkout`}>Sign in</Link> to use your account.
                      </p>
                    </>
                  )}

                  {user && savedAddresses.length > 0 && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <label style={{ marginBottom: "0.4rem" }}>Saved addresses</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: "0.82rem" }}
                            onClick={() => fillFromAddress(addr)}
                          >
                            {addr.label || addr.city} — {addr.full_name}
                          </button>
                        ))}
                      </div>
                    </div>
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
                    <strong>{formatPrice(cartTotal)}</strong>
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
