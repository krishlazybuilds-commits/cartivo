"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import { useAuth, authFetch, extractError } from "../../lib/auth";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

const EMPTY_WAREHOUSE = { name: "", code: "", address: "", is_active: true };

export default function AdminWarehousesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Warehouse CRUD
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_WAREHOUSE);

  // Stock table
  const [stocks, setStocks] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState("");
  const [editStockId, setEditStockId] = useState(null);
  const [editStockValue, setEditStockValue] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/warehouses");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch("/warehouses/");
      setWarehouses(data.results ?? data);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStocks = useCallback(async () => {
    setStockLoading(true);
    try {
      const params = stockFilter ? `?warehouse=${stockFilter}` : "";
      const data = await authFetch(`/warehouse-stocks/${params}`);
      setStocks(data.results ?? data);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setStockLoading(false);
    }
  }, [stockFilter]);

  useEffect(() => {
    if (user?.is_staff) { loadWarehouses(); loadStocks(); }
  }, [user, loadWarehouses, loadStocks]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        const data = await authFetch(`/warehouses/${editId}/`, {
          method: "PATCH", body: JSON.stringify(form),
        });
        setWarehouses((prev) => prev.map((w) => (w.id === editId ? data : w)));
      } else {
        const data = await authFetch("/warehouses/", {
          method: "POST", body: JSON.stringify(form),
        });
        setWarehouses((prev) => [...prev, data]);
      }
      setForm(EMPTY_WAREHOUSE);
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  function handleEdit(w) {
    setEditId(w.id);
    setShowForm(true);
    setForm({ name: w.name, code: w.code, address: w.address, is_active: w.is_active });
  }

  function handleCancel() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_WAREHOUSE);
  }

  async function handleToggleActive(w) {
    try {
      const data = await authFetch(`/warehouses/${w.id}/`, {
        method: "PATCH", body: JSON.stringify({ is_active: !w.is_active }),
      });
      setWarehouses((prev) => prev.map((x) => (x.id === w.id ? data : x)));
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this warehouse?")) return;
    try {
      await authFetch(`/warehouses/${id}/`, { method: "DELETE" });
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  async function handleStockUpdate(ws) {
    const val = parseInt(editStockValue, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await authFetch(`/warehouse-stocks/${ws.id}/`, {
        method: "PATCH", body: JSON.stringify({ stock: val }),
      });
      setStocks((prev) => prev.map((s) => (s.id === ws.id ? { ...s, stock: val } : s)));
      setEditStockId(null);
      setEditStockValue("");
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
              <h2>Warehouses</h2>
              <p>Manage warehouses and view stock levels.</p>
            </div>
          </Reveal>

          <AdminTabs />

          {error && <p className="auth-error" role="alert">{error}</p>}

          {/* ─── Warehouse CRUD ─── */}
          <div className="admin-content">
            <h3 style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Warehouses</span>
              {!showForm && (
                <button
                  className="btn btn-primary" type="button"
                  onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_WAREHOUSE); }}
                >
                  + New warehouse
                </button>
              )}
            </h3>

            {showForm && (
              <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={editId ? "Edit warehouse" : "New warehouse"}>
                <div className="admin-modal">
                  <h3 style={{ marginBottom: "1.25rem" }}>{editId ? "Edit warehouse" : "New warehouse"}</h3>
                  <form onSubmit={handleSave} className="admin-form">
                    <label>
                      Name
                      <input id="wh-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label>
                      Code
                      <input id="wh-code" type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    </label>
                    <label>
                      Address
                      <input id="wh-address" type="text" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </label>
                    <label className="admin-checkbox">
                      <input id="wh-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                      Active
                    </label>
                    <div className="admin-form-actions">
                      <button className="btn btn-ghost" type="button" onClick={handleCancel}>Cancel</button>
                      <button className="btn btn-primary" type="submit">
                        {editId ? "Save" : "Create"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loading ? (
              <p>Loading warehouses…</p>
            ) : warehouses.length === 0 ? (
              <p>No warehouses yet.</p>
            ) : (
              <div className="admin-table-wrap" style={{ overflowX: "auto", marginBottom: "2.5rem" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Name</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Code</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Address</th>
                      <th style={{ textAlign: "center", padding: "0.6rem" }}>Active</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>Created</th>
                      <th style={{ textAlign: "right", padding: "0.6rem" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w) => (
                      <tr key={w.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                        <td style={{ padding: "0.6rem", fontWeight: 500 }}>{w.name}</td>
                        <td style={{ padding: "0.6rem" }}><code>{w.code}</code></td>
                        <td style={{ padding: "0.6rem", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85em" }}>{w.address || "—"}</td>
                        <td style={{ padding: "0.6rem", textAlign: "center" }}>
                          <button type="button" style={{
                            border: "none", cursor: "pointer", background: "none",
                            fontSize: "1.1em", opacity: w.is_active ? 1 : 0.3,
                          }} onClick={() => handleToggleActive(w)} title="Toggle active">
                            {w.is_active ? "✓" : "✗"}
                          </button>
                        </td>
                        <td style={{ padding: "0.6rem", fontSize: "0.85em", whiteSpace: "nowrap" }}>{formatDate(w.created_at)}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="btn" type="button" style={{ fontSize: "0.85em", padding: "0.25rem 0.6rem" }} onClick={() => handleEdit(w)}>Edit</button>{" "}
                          <button className="btn btn-danger" type="button" style={{ fontSize: "0.85em", padding: "0.25rem 0.6rem" }} onClick={() => handleDelete(w.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Stock Table ─── */}
          <div className="admin-content">
            <h3 style={{ marginBottom: "1rem" }}>Stock levels</h3>

            <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Filter by Warehouse:</label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                style={{ padding: "0.6rem 1rem", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--bg)", font: "inherit", fontSize: "0.9rem", minWidth: "200px" }}
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {stockLoading ? (
              <p>Loading stock…</p>
            ) : stocks.length === 0 ? (
              <p>No stock entries found.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Product</th>
                      <th>Variant</th>
                      <th style={{ textAlign: "center" }}>Stock</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((s) => {
                      const warehouseName = warehouses.find((w) => w.id === s.warehouse)?.name || `#${s.warehouse}`;
                      return (
                        <tr key={s.id}>
                          <td>{warehouseName}</td>
                          <td style={{ fontWeight: 500 }}>{s.product_name}</td>
                          <td style={{ fontSize: "0.85em", opacity: 0.7 }}>{s.variant_name || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            {editStockId === s.id ? (
                              <input
                                type="number" min="0"
                                value={editStockValue}
                                onChange={(e) => setEditStockValue(e.target.value)}
                                style={{ width: "70px", padding: "0.3rem 0.5rem", borderRadius: "8px", border: "1px solid var(--line)", textAlign: "center", font: "inherit", background: "var(--bg)" }}
                                autoFocus
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{s.stock}</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {editStockId === s.id ? (
                              <>
                                <button className="btn btn-primary" type="button" onClick={() => handleStockUpdate(s)}>Save</button>{" "}
                                <button className="btn" type="button" onClick={() => { setEditStockId(null); setEditStockValue(""); }}>Cancel</button>
                              </>
                            ) : (
                              <button className="btn" type="button" onClick={() => { setEditStockId(s.id); setEditStockValue(String(s.stock)); }}>Edit</button>
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
