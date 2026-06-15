"use client";

import { useState } from "react";
import Link from "next/link";

import Reveal from "../../components/Reveal";
import { API_URL } from "../../lib/api";
import { formatPrice } from "../../lib/format";

const STATUS_LABELS = {
  pending: "Pending payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default function GuestOrderLookupPage() {
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/orders/guest-lookup/?email=${encodeURIComponent(email.trim())}&order_number=${encodeURIComponent(orderNumber.trim())}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Order not found.");
      } else {
        setOrder(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="features">
        <div className="container">
          <Reveal>
            <div className="section-head center">
              <span className="eyebrow">Orders</span>
              <h2>Track your order</h2>
              <p>Enter the email address you used at checkout and your order number.</p>
            </div>
          </Reveal>

          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <form className="auth-form" onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <label>
                Email address
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
              </label>
              <label>
                Order number
                <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required placeholder="e.g. A1B2C3D4" style={{ textTransform: "uppercase" }} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Looking up…" : "Find order"}
              </button>
              <p className="auth-alt">
                Have an account? <Link href="/login?next=/orders">Sign in</Link> to see all your orders.
              </p>
            </form>

            {order && (
              <div className="order-card" style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0 }}>Order {String(order.order_number).slice(0, 8).toUpperCase()}</h3>
                  <span className={`product-stock${["cancelled", "refunded"].includes(order.status) ? " out" : ""}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
                  {order.items.map(item => (
                    <li key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: ".9rem" }}>
                      <span>{item.quantity} × {item.product_name}</span>
                      <span>{formatPrice(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <p style={{ marginTop: ".75rem", fontSize: ".85rem", opacity: .7 }}>
                  Shipping to {order.shipping_full_name}, {order.shipping_city}, {order.shipping_country}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
