"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import { AdminTableSkeleton } from "../../components/Skeleton";
import { useAuth, authFetch, extractError } from "../../lib/auth";

const STATUS_LABELS = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const TRANSITIONS = {
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
};

function formatDate(v) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString(); } catch { return "—"; }
}

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refundFilter, setRefundFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [trackingInputs, setTrackingInputs] = useState({});
  const [exportBusy, setExportBusy] = useState(false);

  const CARRIER_OPTIONS = [
    { value: "", label: "Select carrier" },
    { value: "ups", label: "UPS" },
    { value: "fedex", label: "FedEx" },
    { value: "usps", label: "USPS" },
    { value: "dhl", label: "DHL" },
    { value: "other", label: "Other" },
  ];

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/orders");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("search", query);
      if (statusFilter) params.set("status", statusFilter);
      if (refundFilter) params.set("has_refund_request", "true");
      const data = await authFetch(`/orders/?${params.toString()}`);
      const results = data.results ?? data;
      setOrders(results);
      setCount(data.count ?? results.length);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter, refundFilter]);

  useEffect(() => {
    if (user?.is_staff) loadOrders();
  }, [user, loadOrders]);

  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  async function updateStatus(order, newStatus) {
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await authFetch(`/orders/${order.id}/status/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setBusyId(null);
    }
  }

  async function updateTracking(orderId) {
    const input = trackingInputs[orderId];
    if (!input?.tracking_number?.trim()) return;
    setBusyId(orderId);
    setError(null);
    try {
      const updated = await authFetch(`/orders/${orderId}/tracking/`, {
        method: "PATCH",
        body: JSON.stringify({ tracking_number: input.tracking_number.trim(), carrier: input.carrier || "" }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setTrackingInputs((prev) => ({ ...prev, [orderId]: { ...prev[orderId], saved: true } }));
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(fmt) {
    setExportBusy(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${base}/orders/export/?format=${fmt}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  }

  if (authLoading || !user?.is_staff) return null;

  return (
    <main>
      <section className="features">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Admin</span>
              <h2>Order management</h2>
              <p>View all orders and advance their fulfilment status.</p>
            </div>
          </Reveal>

          <AdminTabs />

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.5rem", width: "100%" }}>
            <div className="admin-search" style={{ margin: 0, flex: "1 1 280px", maxWidth: "400px" }}>
              <input
                type="search"
                placeholder="Search order number or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search orders"
              />
            </div>
            
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label="Filter by status"
                style={{ padding: "0.6rem 1rem", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--bg)", font: "inherit", fontSize: "0.9rem" }}
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", cursor: "pointer", userSelect: "none", height: "38px" }}>
                <input
                  type="checkbox"
                  checked={refundFilter}
                  onChange={(e) => { setRefundFilter(e.target.checked); setPage(1); }}
                  style={{ width: "auto", margin: 0 }}
                />
                Refund requests only
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={() => handleExport("csv")} disabled={exportBusy}>
                {exportBusy ? "Exporting…" : "Export CSV"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => handleExport("xlsx")} disabled={exportBusy}>
                {exportBusy ? "Exporting…" : "Export Excel"}
              </button>
            </div>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="admin-content">
            {loading ? (
              <AdminTableSkeleton columns={6} rows={6} />
            ) : orders.length === 0 ? (
              <p>No orders found.</p>
            ) : (
              <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Order</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Customer</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Total</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Status</th>
                      <th style={{ textAlign: "right", padding: "0.6rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const busy = busyId === o.id;
                      const next = TRANSITIONS[o.status] ?? [];
                      const customer = o.user
                        ? (o.user.username ?? o.user.email ?? `#${o.user}`)
                        : (o.guest_email || "Guest");
                      return (
                        <tr key={o.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.9em" }}>
                            {String(o.order_number ?? o.id).slice(0, 8).toUpperCase()}
                          </td>
                          <td style={{ padding: "0.6rem" }}>
                            <div>{customer}</div>
                            {o.refund_request_reason && (
                              <div style={{ fontSize: "0.78rem", color: "#ef4444", marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "4px", maxWidth: "250px", whiteSpace: "normal" }}>
                                <span style={{ fontWeight: 600 }}>Refund Reason:</span> &ldquo;{o.refund_request_reason}&rdquo;
                              </div>
                            )}
                            {o.notes && (
                              <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", maxWidth: "250px", whiteSpace: "pre-wrap" }}>
                                <span style={{ fontWeight: 600 }}>Notes:</span> &ldquo;{o.notes}&rdquo;
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "0.6rem" }}>{formatDate(o.created_at)}</td>
                          <td style={{ padding: "0.6rem" }}>${Number(o.total).toFixed(2)}</td>
                          <td style={{ padding: "0.6rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-start" }}>
                              <span className={`product-stock${["cancelled", "refunded"].includes(o.status) ? " out" : o.status === "delivered" ? "" : ""}`}>
                                {STATUS_LABELS[o.status] ?? o.status}
                              </span>
                              {o.refund_request_reason && o.status !== "refunded" && (
                                <span className="product-stock out" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                                  Refund Requested
                                </span>
                              )}
                              {o.tracking_number && (
                                <span style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}>
                                  <strong>Tracking:</strong> {o.tracking_number}
                                  {o.carrier ? ` (${o.carrier.toUpperCase()})` : ""}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                            {next.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`btn ${s === "cancelled" ? "btn-danger" : "btn-ghost"}`}
                                style={{ marginLeft: "0.5rem" }}
                                disabled={busy}
                                onClick={() => updateStatus(o, s)}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                            {["paid", "shipped"].includes(o.status) && (
                              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <input
                                  type="text"
                                  placeholder="Tracking #"
                                  value={trackingInputs[o.id]?.tracking_number ?? o.tracking_number ?? ""}
                                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [o.id]: { ...prev[o.id], tracking_number: e.target.value } }))}
                                  style={{ width: 120, fontSize: "0.8rem", padding: "0.3rem 0.5rem", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--bg)", font: "inherit" }}
                                  disabled={busy}
                                />
                                <select
                                  value={trackingInputs[o.id]?.carrier ?? o.carrier ?? ""}
                                  onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [o.id]: { ...prev[o.id], carrier: e.target.value } }))}
                                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem", width: 95, borderRadius: "8px", border: "1px solid var(--line)", background: "var(--bg)", font: "inherit" }}
                                  disabled={busy}
                                >
                                  {CARRIER_OPTIONS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}
                                  disabled={busy || !(trackingInputs[o.id]?.tracking_number ?? o.tracking_number ?? "")}
                                  onClick={() => updateTracking(o.id)}
                                >
                                  {busy ? "…" : o.tracking_number ? "Update" : "Save"}
                                </button>
                              </div>
                            )}
                            {next.length === 0 && !["paid", "shipped"].includes(o.status) && <span style={{ opacity: 0.4, fontSize: "0.85em" }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.5rem" }}>
              <button type="button" className="btn btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" className="btn btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
