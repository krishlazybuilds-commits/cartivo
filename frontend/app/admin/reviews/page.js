"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import { useAuth, authFetch, extractError } from "../../lib/auth";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLORS = {
  pending: { bg: "#fef3c7", color: "#92400e" },
  approved: { bg: "#d1fae5", color: "#065f46" },
  rejected: { bg: "#fee2e2", color: "#991b1b" },
};

export default function AdminReviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/reviews");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const data = await authFetch(`/reviews/${params}`);
      setReviews(data.results ?? data);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (user?.is_staff) loadReviews();
  }, [user, loadReviews]);

  async function handleApprove(id) {
    try {
      await authFetch(`/reviews/${id}/approve/`, { method: "POST" });
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  async function handleReject(id) {
    try {
      await authFetch(`/reviews/${id}/reject/`, { method: "POST" });
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    } catch (err) {
      setError(extractError(err.data, err.message));
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
              <h2>Review moderation</h2>
              <p>Approve or reject customer reviews before they go live.</p>
            </div>
          </Reveal>

          <AdminTabs />

          {error && <p className="auth-error" role="alert">{error}</p>}

          {/* Status filter tabs */}
          <div className="admin-tabs" style={{ marginBottom: "1.5rem" }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`admin-tab${statusFilter === f.value ? " active" : ""}`}
                onClick={() => setStatusFilter(f.value)}
                aria-current={statusFilter === f.value ? "page" : undefined}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="admin-content">
            {loading ? (
              <p>Loading reviews…</p>
            ) : reviews.length === 0 ? (
              <p>No reviews found.</p>
            ) : (
              <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Product</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Author</th>
                      <th style={{ textAlign: "center", padding: "0.6rem" }}>Rating</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Review</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Date</th>
                      <th style={{ textAlign: "center", padding: "0.6rem" }}>Status</th>
                      <th style={{ textAlign: "right", padding: "0.6rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r) => {
                      const sc = STATUS_COLORS[r.status] || { bg: "#f3f4f6", color: "#374151" };
                      return (
                        <tr key={r.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                          <td style={{ padding: "0.6rem", fontWeight: 500 }}>{r.product_name || `#${r.product}`}</td>
                          <td style={{ padding: "0.6rem" }}>{r.username}</td>
                          <td style={{ padding: "0.6rem", textAlign: "center" }}>{r.rating}★</td>
                          <td style={{ padding: "0.6rem", maxWidth: 300 }}>
                            {r.title && <div style={{ fontWeight: 600 }}>{r.title}</div>}
                            {r.body && <div style={{ fontSize: "0.85em", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.body}</div>}
                          </td>
                          <td style={{ padding: "0.6rem", fontSize: "0.85em", whiteSpace: "nowrap" }}>{formatDate(r.created_at)}</td>
                          <td style={{ padding: "0.6rem", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: "999px",
                              fontSize: "0.78em", fontWeight: 600, ...sc,
                            }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ padding: "0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                            {r.status === "pending" && (
                              <>
                                <button className="btn btn-primary" type="button" style={{ fontSize: "0.85em", padding: "0.3rem 0.7rem" }} onClick={() => handleApprove(r.id)}>Approve</button>{" "}
                                <button className="btn btn-danger" type="button" style={{ fontSize: "0.85em", padding: "0.3rem 0.7rem" }} onClick={() => handleReject(r.id)}>Reject</button>
                              </>
                            )}
                            {r.status !== "pending" && (
                              <span style={{ fontSize: "0.85em", opacity: 0.4 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
