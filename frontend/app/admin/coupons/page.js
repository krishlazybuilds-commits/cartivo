"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { AdminTableSkeleton } from "../../components/Skeleton";
import { useAuth, authFetch, extractError } from "../../lib/auth";

const EMPTY_FORM = {
  code: "", discount_type: "percent", value: "", min_order_amount: "0",
  max_uses: "0", valid_from: "", valid_until: "", is_active: true,
};

function toInputDate(iso) {
  if (!iso) return "";
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

export default function AdminCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | coupon object
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/coupons");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch("/coupons/");
      setCoupons(data.results ?? data);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_staff) loadCoupons();
  }, [user, loadCoupons]);

  function openNew() {
    setForm({ ...EMPTY_FORM, valid_from: toInputDate(new Date().toISOString()) });
    setFormErr(null);
    setEditing("new");
  }

  function openEdit(coupon) {
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      value: String(coupon.value),
      min_order_amount: String(coupon.min_order_amount),
      max_uses: String(coupon.max_uses),
      valid_from: toInputDate(coupon.valid_from),
      valid_until: toInputDate(coupon.valid_until),
      is_active: coupon.is_active,
    });
    setFormErr(null);
    setEditing(coupon);
  }

  function up(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      value: form.value,
      min_order_amount: form.min_order_amount || "0",
      max_uses: form.max_uses || "0",
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      is_active: form.is_active,
    };
    try {
      if (editing === "new") {
        const created = await authFetch("/coupons/", { method: "POST", body: JSON.stringify(payload) });
        setCoupons((prev) => [created, ...prev]);
      } else {
        const updated = await authFetch(`/coupons/${editing.id}/`, { method: "PUT", body: JSON.stringify(payload) });
        setCoupons((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      setEditing(null);
    } catch (err) {
      setFormErr(extractError(err.data, err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const coupon = pendingDelete;
    setPendingDelete(null);
    try {
      await authFetch(`/coupons/${coupon.id}/`, { method: "DELETE" });
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
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
              <h2>Coupon management</h2>
              <p>Create and manage discount codes.</p>
            </div>
          </Reveal>

          <AdminTabs />

          <div style={{ marginBottom: "1.5rem" }}>
            <button className="btn btn-primary" type="button" onClick={openNew}>+ New coupon</button>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          {/* Form panel */}
          {editing && (
            <div className="order-card" style={{ marginBottom: "2rem", maxWidth: 560 }}>
              <h3 style={{ marginBottom: "1rem" }}>{editing === "new" ? "New coupon" : `Edit ${editing.code}`}</h3>
              <form onSubmit={handleSave} style={{ display: "grid", gap: "0.9rem" }}>
                <label>
                  Code
                  <input value={form.code} onChange={up("code")} required placeholder="SUMMER20" style={{ textTransform: "uppercase" }} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label>
                    Type
                    <select value={form.discount_type} onChange={up("discount_type")}>
                      <option value="percent">Percentage</option>
                      <option value="flat">Flat amount ($)</option>
                    </select>
                  </label>
                  <label>
                    Value
                    <input type="number" min="0.01" step="0.01" value={form.value} onChange={up("value")} required />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label>
                    Min order ($)
                    <input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={up("min_order_amount")} />
                  </label>
                  <label>
                    Max uses <span style={{ opacity: 0.5, fontSize: "0.8em" }}>(0 = unlimited)</span>
                    <input type="number" min="0" value={form.max_uses} onChange={up("max_uses")} />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <label>
                    Valid from
                    <input type="datetime-local" value={form.valid_from} onChange={up("valid_from")} />
                  </label>
                  <label>
                    Valid until <span style={{ opacity: 0.5, fontSize: "0.8em" }}>(optional)</span>
                    <input type="datetime-local" value={form.valid_until} onChange={up("valid_until")} />
                  </label>
                </div>
                <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", display: "flex" }}>
                  <input type="checkbox" checked={form.is_active} onChange={up("is_active")} />
                  Active
                </label>
                {formErr && <p className="auth-error">{formErr}</p>}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Table */}
          <div className="admin-content">
            {loading ? (
              <AdminTableSkeleton columns={6} rows={5} />
            ) : coupons.length === 0 ? (
              <p>No coupons yet.</p>
            ) : (
              <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Code</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Discount</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Uses</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Expires</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Status</th>
                      <th style={{ textAlign: "right", padding: "0.6rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                        <td style={{ padding: "0.6rem", fontFamily: "monospace", fontWeight: 600 }}>{c.code}</td>
                        <td style={{ padding: "0.6rem" }}>
                          {c.discount_type === "percent" ? `${c.value}%` : `$${c.value}`}
                          {Number(c.min_order_amount) > 0 && (
                            <span style={{ opacity: 0.5, fontSize: "0.8em" }}> min ${c.min_order_amount}</span>
                          )}
                        </td>
                        <td style={{ padding: "0.6rem" }}>
                          {c.times_used}{c.max_uses > 0 ? ` / ${c.max_uses}` : ""}
                        </td>
                        <td style={{ padding: "0.6rem", fontSize: "0.85em" }}>
                          {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>
                          <span className={`product-stock${c.is_active ? "" : " out"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="btn btn-ghost" type="button" onClick={() => openEdit(c)}>Edit</button>{" "}
                          <button className="btn btn-danger" type="button" onClick={() => setPendingDelete(c)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete coupon?"
        message={`Permanently delete coupon "${pendingDelete?.code}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
