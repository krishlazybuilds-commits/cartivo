"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { authFetch } from "../lib/auth";
import { fetchShippingEstimate } from "../lib/api";
import { formatPrice } from "../lib/format";

const EMPTY = {
  shipping_full_name: "",
  shipping_address: "",
  shipping_city: "",
  shipping_postal_code: "",
  shipping_country: "US",
  guest_email: "",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/** Place an order as a guest (no auth cookies, no CSRF needed for this call). */
async function guestCheckout(payload) {
  const res = await fetch(`${API_URL}/orders/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = {}; }
    const msg = detail?.detail || Object.values(detail).flat()[0] || "Checkout failed.";
    const err = new Error(msg);
    err.data = detail;
    throw err;
  }
  return res.json();
}

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState(null);

  const isGuest = !authLoading && !user;

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let order;
    try {
      if (isGuest) {
        // Build the items payload from the localStorage guest cart.
        const items = (cart?.items || []).map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        }));
        order = await guestCheckout({ ...form, items });
        // Clear the guest cart in localStorage.
        if (typeof window !== "undefined") {
          localStorage.removeItem("cartivo_guest_cart");
        }
        await refresh();
      } else {
        order = await authFetch("/orders/", {
          method: "POST",
          body: JSON.stringify(form),
        });
        await refresh();
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    // Redirect to Stripe Checkout.
    try {
      const payFetch = isGuest
        ? () => fetch(`${API_URL}/orders/${order.id}/pay/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).then((r) => r.json())
        : () => authFetch(`/orders/${order.id}/pay/`, { method: "POST" });

      const { url } = await payFetch();
      window.location.href = url;
    } catch {
      // Order created but payment couldn't start — let user retry from order page.
      router.push(isGuest ? "/" : `/orders/${order.id}`);
    }
  }

  if (authLoading) return null;

  const isEmpty = !cart || cart.items.length === 0;

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

                  {/* Guest email — only shown when not logged in */}
                  {isGuest && (
                    <label>
                      Email address
                      <input
                        type="email"
                        value={form.guest_email}
                        onChange={update("guest_email")}
                        placeholder="you@example.com"
                        required
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        Your order confirmation will be sent here.{" "}
                        <Link href="/login">Sign in</Link> for faster checkout.
                      </span>
                    </label>
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

                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Redirecting to payment…" : `Pay · ${formatPrice(cart.total)}`}
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

                  {/* Shipping & tax estimate */}
                  {estimate && (
                    <div style={{ fontSize: "0.875rem", marginTop: "0.5rem", display: "grid", gap: "0.2rem" }}>
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
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
