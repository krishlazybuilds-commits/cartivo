"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
      const data = await authFetch(`/orders/?${params.toString()}`);
      const results = data.results ?? data;
      setOrders(results);
      setCount(data.count ?? results.length);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

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

          <div className="admin-search" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <input
              type="search"
              placeholder="Search by order number or customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search orders"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="admin-content">
            {loading ? (
              <p>Loading orders…</p>
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
                          <td style={{ padding: "0.6rem" }}>{customer}</td>
                          <td style={{ padding: "0.6rem" }}>{formatDate(o.created_at)}</td>
                          <td style={{ padding: "0.6rem" }}>${Number(o.total).toFixed(2)}</td>
                          <td style={{ padding: "0.6rem" }}>
                            <span className={`product-stock${["cancelled", "refunded"].includes(o.status) ? " out" : o.status === "delivered" ? "" : ""}`}>
                              {STATUS_LABELS[o.status] ?? o.status}
                            </span>
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
                            {next.length === 0 && <span style={{ opacity: 0.4, fontSize: "0.85em" }}>—</span>}
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
