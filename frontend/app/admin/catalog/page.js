"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth, authFetch, extractError } from "../../lib/auth";
import { formatPrice } from "../../lib/format";

const EMPTY_FORM = {
  name: "",
  category: "",
  price: "",
  stock: "",
  sku: "",
  description: "",
  is_active: true,
};

export default function AdminCatalogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = !!user?.is_staff;

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Product form state. `editing` holds the product slug being edited (or null
  // for a new product); `form` is closed when null.
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // Category quick-add.
  const [newCategory, setNewCategory] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catToDelete, setCatToDelete] = useState(null);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/catalog");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch(`/products/?page=${page}`);
      const results = data.results ?? data;
      setProducts(results);
      setCount(data.count ?? results.length);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await authFetch("/categories/");
      setCategories(data.results ?? data);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadProducts();
      loadCategories();
    }
  }, [isAdmin, loadProducts, loadCategories]);

  function openNew() {
    setEditing(null);
    setImageFile(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.id ?? "" });
  }

  function openEdit(p) {
    setEditing(p.slug);
    setImageFile(null);
    setForm({
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      sku: p.sku,
      description: p.description ?? "",
      is_active: p.is_active,
    });
  }

  function closeForm() {
    setForm(null);
    setEditing(null);
    setImageFile(null);
  }

  async function saveProduct(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("category", form.category);
      fd.append("price", form.price);
      fd.append("stock", form.stock);
      fd.append("sku", form.sku);
      fd.append("description", form.description);
      fd.append("is_active", form.is_active ? "true" : "false");
      if (imageFile) fd.append("image", imageFile);

      if (editing) {
        await authFetch(`/products/${editing}/`, { method: "PATCH", body: fd });
      } else {
        await authFetch("/products/", { method: "POST", body: fd });
      }
      closeForm();
      await loadProducts();
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteProduct() {
    const target = toDelete;
    setToDelete(null);
    if (!target) return;
    setError(null);
    try {
      await authFetch(`/products/${target.slug}/`, { method: "DELETE" });
      await loadProducts();
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setCatBusy(true);
    setError(null);
    try {
      await authFetch("/categories/", {
        method: "POST",
        body: JSON.stringify({ name: newCategory.trim() }),
      });
      setNewCategory("");
      await loadCategories();
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setCatBusy(false);
    }
  }

  async function confirmDeleteCategory() {
    const target = catToDelete;
    setCatToDelete(null);
    if (!target) return;
    setError(null);
    try {
      await authFetch(`/categories/${target.slug}/`, { method: "DELETE" });
      await loadCategories();
    } catch (err) {
      setError(extractError(err.data, err.message));
    }
  }

  if (authLoading || !user || !user.is_staff) return null;

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Admin</span>
                <h2>Catalog management</h2>
                <p>Create, edit, and remove products and categories.</p>
              </div>
            </Reveal>

            <AdminTabs />

            {error && <p className="auth-error" role="alert">{error}</p>}

            {/* Categories */}
            <div className="admin-panel">
              <div className="admin-panel-head">
                <h3>Categories</h3>
                <form onSubmit={addCategory} className="admin-inline-form">
                  <input
                    type="text"
                    placeholder="New category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    aria-label="New category name"
                  />
                  <button type="submit" className="btn btn-ghost" disabled={catBusy}>
                    {catBusy ? "Adding…" : "Add"}
                  </button>
                </form>
              </div>
              {categories.length === 0 ? (
                <p className="reviews-note">No categories yet.</p>
              ) : (
                <ul className="admin-chip-list">
                  {categories.map((c) => (
                    <li key={c.id} className="admin-chip">
                      {c.name}
                      <button
                        type="button"
                        className="admin-chip-x"
                        onClick={() => setCatToDelete(c)}
                        aria-label={`Delete category ${c.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Products */}
            <div className="admin-panel">
              <div className="admin-panel-head">
                <h3>Products</h3>
                <button type="button" className="btn btn-primary" onClick={openNew}>
                  + New product
                </button>
              </div>

              {loading ? (
                <p>Loading products…</p>
              ) : products.length === 0 ? (
                <p>No products yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <div className="admin-sku">{p.sku}</div>
                          </td>
                          <td>{p.category_name ?? "—"}</td>
                          <td>{formatPrice(p.price)}</td>
                          <td>{p.stock}</td>
                          <td>
                            <span className={p.is_active ? "product-stock" : "product-stock out"}>
                              {p.is_active ? "Active" : "Hidden"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button type="button" className="btn btn-ghost" onClick={() => openEdit(p)}>
                              Edit
                            </button>{" "}
                            <button type="button" className="btn btn-danger" onClick={() => setToDelete(p)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="pagination" style={{ marginTop: "1.5rem" }}>
                  <button type="button" className="btn btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                    ← Prev
                  </button>
                  <span className="pagination-info">Page {page} of {totalPages}</span>
                  <button type="button" className="btn btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Product form modal */}
      {form && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={editing ? "Edit product" : "New product"}>
          <div className="admin-modal">
            <h3>{editing ? "Edit product" : "New product"}</h3>
            <form onSubmit={saveProduct} className="admin-form">
              <label>
                Name
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Category
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <div className="admin-form-row">
                <label>
                  Price (USD)
                  <input type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </label>
              </div>
              <label>
                SKU
                <input type="text" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label>
                Image {editing && <span className="reviews-note">(leave empty to keep current)</span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active (visible in shop)
              </label>
              <div className="admin-form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete product?"
        message={toDelete ? `Permanently delete "${toDelete.name}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteProduct}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={!!catToDelete}
        title="Delete category?"
        message={catToDelete ? `Delete category "${catToDelete.name}"? Products using it must be reassigned first.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteCategory}
        onCancel={() => setCatToDelete(null)}
      />
    </>
  );
}
