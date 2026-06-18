"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import Reveal from "../../components/Reveal";
import Breadcrumbs from "../../components/Breadcrumbs";
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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMsg, setRefundMsg] = useState(null);
  const [refundErr, setRefundErr] = useState(null);

  async function handleRefundRequest(e) {
    e.preventDefault();
    setRefundSubmitting(true);
    setRefundErr(null);
    try {
      const updated = await authFetch(`/orders/${id}/refund-request/`, {
        method: "POST",
        body: JSON.stringify({ reason: refundReason }),
      });
      setOrder(updated);
      setRefundMsg("Refund request submitted. Our team will review it shortly.");
      setShowRefundForm(false);
    } catch (err) {
      setRefundErr(err.message);
    } finally {
      setRefundSubmitting(false);
    }
  }

  async function handlePay() {
    setPaying(true);
    setPayError(null);
    try {
      const { url } = await authFetch(`/orders/${id}/pay/`, { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setPayError(err.message);
      setPaying(false);
    }
  }

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
      <main>
        <section className="features">
          <div className="container">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Orders", href: "/orders" },
                { label: `Order #${id}` },
              ]}
            />

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
                    <strong>Order {order.order_number?.slice(0, 8).toUpperCase() || `#${order.id}`}</strong>
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

                <div className="cart-summary" style={{ marginTop: "1rem", display: "grid", gap: "0.25rem", fontSize: "0.95rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Subtotal</span>
                    <span>{formatPrice(order.items.reduce((acc, item) => acc + parseFloat(item.subtotal), 0))}</span>
                  </div>
                  {parseFloat(order.discount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success, #16a34a)" }}>
                      <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                      <span>-{formatPrice(order.discount)}</span>
                    </div>
                  )}
                  {parseFloat(order.shipping_cost) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Shipping</span>
                      <span>{formatPrice(order.shipping_cost)}</span>
                    </div>
                  )}
                  {parseFloat(order.tax_amount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Tax</span>
                      <span>{formatPrice(order.tax_amount)}</span>
                    </div>
                  )}
                  <div className="cart-total" style={{ marginTop: "0.5rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}>
                    <span>Total</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
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

                {order.tracking_number && ["shipped", "delivered"].includes(order.status) && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                    <h3 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Tracking</h3>
                    <p style={{ color: "var(--slate)", lineHeight: 1.8 }}>
                      <strong>Carrier:</strong> {order.carrier ? order.carrier.toUpperCase() : "N/A"}<br />
                      <strong>Tracking #:</strong> {order.tracking_number}
                    </p>
                  </div>
                )}

                {order.status !== "pending" && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                    <button className="btn btn-ghost" type="button" onClick={async () => {
                      try {
                        const res = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/orders/${id}/invoice/`,
                          { credentials: "include" }
                        );
                        if (!res.ok) throw new Error("Download failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `invoice-${String(order.order_number ?? order.id).slice(0, 8).toUpperCase()}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        setError(e.message);
                      }
                    }}>
                      Download Invoice (PDF)
                    </button>
                  </div>
                )}

                {order.status === "pending" && (
                  <div style={{ marginTop: "1.5rem" }}>
                    {payError && <p className="auth-error" role="alert">{payError}</p>}
                    {cancelError && <p className="auth-error" role="alert">{cancelError}</p>}
                    <p className="product-cat" style={{ marginBottom: "0.75rem" }}>
                      This order is awaiting payment.
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-primary"
                        onClick={handlePay}
                        disabled={paying}
                      >
                        {paying ? "Redirecting…" : "Complete payment"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setConfirmCancel(true)}
                        disabled={cancelling}
                        style={{ color: "var(--error, #dc2626)" }}
                      >
                        {cancelling ? "Cancelling…" : "Cancel order"}
                      </button>
                    </div>
                  </div>
                )}

                {["paid", "shipped", "delivered"].includes(order.status) && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                    {order.refund_request_reason ? (
                      <p style={{ fontSize: ".875rem", opacity: .7 }}>
                        ✓ Refund request submitted. Our team will be in touch.
                      </p>
                    ) : (
                      <>
                        {refundMsg && <p className="auth-success" style={{ marginBottom: ".75rem" }}>{refundMsg}</p>}
                        {!showRefundForm ? (
                          <button className="btn btn-ghost" type="button" onClick={() => setShowRefundForm(true)}>
                            Request a refund
                          </button>
                        ) : (
                          <form onSubmit={handleRefundRequest} style={{ display: "grid", gap: ".75rem" }}>
                            <label style={{ fontSize: ".9rem" }}>
                              Reason for refund
                              <textarea
                                rows={3}
                                value={refundReason}
                                onChange={e => setRefundReason(e.target.value)}
                                required
                                placeholder="Please describe why you'd like a refund…"
                                style={{ marginTop: ".4rem", width: "100%", resize: "vertical" }}
                              />
                            </label>
                            {refundErr && <p className="auth-error">{refundErr}</p>}
                            <div style={{ display: "flex", gap: ".75rem" }}>
                              <button className="btn btn-primary" type="submit" disabled={refundSubmitting}>
                                {refundSubmitting ? "Submitting…" : "Submit request"}
                              </button>
                              <button className="btn btn-ghost" type="button" onClick={() => setShowRefundForm(false)}>Cancel</button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
              </Reveal>
            )}
          </div>
        </section>
      </main>

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
