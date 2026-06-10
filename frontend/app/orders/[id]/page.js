"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import Reveal from "../../components/Reveal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth, authFetch } from "../../lib/auth";
import { OrderDetailSkeleton } from "../../components/Skeleton";
import { formatPrice } from "../../lib/format";

function formatDate(v) {
  return new Date(v).toLocaleString();
}

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function handleCancel() {
    setConfirmCancel(false);
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await authFetch(`/orders/${id}/cancel/`, { method: "POST" });
      setOrder(updated);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const data = await authFetch(`/orders/${id}/`);
        if (active) setOrder(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, authLoading, id]);

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <p className="product-back">
              <Link href="/orders">← Back to orders</Link>
            </p>

            {!user && !authLoading ? (
              <p className="center">Please <Link href="/login">sign in</Link> to view this order.</p>
            ) : loading ? (
              <OrderDetailSkeleton />
            ) : error ? (
              <p className="center auth-error">{error}</p>
            ) : order && (
              <Reveal>
                <article className="order-card" style={{ maxWidth: 640 }}>
                <header className="order-head">
                  <div>
                    <strong>Order #{order.id}</strong>
                    <span className="product-cat"> {formatDate(order.created_at)}</span>
                  </div>
                  <span className={`order-status status-${order.status}`}>{order.status}</span>
                </header>

                <ul className="order-items">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.quantity} × {item.product_name}</span>
                      <span>{formatPrice(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                <div className="cart-total">
                  <span>Total</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                  <h3 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Shipping address</h3>
                  <p style={{ color: "var(--slate)", lineHeight: 1.8 }}>
                    {order.shipping_full_name}<br />
                    {order.shipping_address}<br />
                    {order.shipping_city}, {order.shipping_postal_code}<br />
                    {order.shipping_country}
                  </p>
                </div>

                {order.status === "pending" && (
                  <div style={{ marginTop: "1.5rem" }}>
                    {cancelError && <p className="auth-error" role="alert">{cancelError}</p>}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmCancel(true)}
                      disabled={cancelling}
                      style={{ color: "var(--error, #dc2626)" }}
                    >
                      {cancelling ? "Cancelling…" : "Cancel order"}
                    </button>
                  </div>
                )}
              </article>
              </Reveal>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message="This will cancel your order. This action can't be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
