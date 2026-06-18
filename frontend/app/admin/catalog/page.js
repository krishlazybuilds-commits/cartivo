"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { AdminTableSkeleton } from "../../components/Skeleton";
import { useAuth, authFetch, extractError } from "../../lib/auth";
import { formatPrice } from "../../lib/format";

const EMPTY_FORM = {
  name: "",
  category: "",
  price: "",
  sale_price: "",
  stock: "",
  sku: "",
  description: "",
  is_active: true,
  is_featured: false,
  is_new: false,
  on_sale: false,
  badge: "",
};

export default function AdminCatalogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = !!user?.is_staff;

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
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

  // Export/import state.
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  // Bulk stock editing state
  const [stockEdits, setStockEdits] = useState({});
  const [savingStock, setSavingStock] = useState(false);
  const hasStockEdits = Object.keys(stockEdits).length > 0;

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
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set("search", query);
      const data = await authFetch(`/products/?${params.toString()}`);
      const results = data.results ?? data;
      setProducts(results);
      setCount(data.count ?? results.length);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

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

  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  async function handleExport(fmt) {
    setExportBusy(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/products/export/?format=${fmt}`, {
        credentials: "include",
        headers: { "X-CSRFToken": document.cookie.match(/csrf=[^;]+/)?.[0]?.split("=")?.[1] ?? "" },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products.${fmt}`;
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

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await authFetch("/products/import_products/", { method: "POST", body: fd });
      setImportResult(data);
      await loadProducts();
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setImportBusy(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function handleBulkStock() {
    setSavingStock(true);
    setError(null);
    try {
      const products = Object.entries(stockEdits).map(([id, stock]) => ({ id: Number(id), stock: Number(stock) }));
      await authFetch("/products/bulk-stock/", { method: "POST", body: JSON.stringify({ products }) });
      setStockEdits({});
      await loadProducts();
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setSavingStock(false);
    }
  }

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
      sale_price: p.sale_price ?? "",
      stock: p.stock,
      sku: p.sku,
      description: p.description ?? "",
      is_active: p.is_active,
      is_featured: p.is_featured,
      is_new: p.is_new,
      on_sale: p.on_sale,
      badge: p.badge ?? "",
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
      fd.append("is_featured", form.is_featured ? "true" : "false");
      fd.append("is_new", form.is_new ? "true" : "false");
      fd.append("on_sale", form.on_sale ? "true" : "false");
      fd.append("badge", form.badge);
      if (form.sale_price) fd.append("sale_price", form.sale_price);
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

  // Variant management state
  const [variantProduct, setVariantProduct] = useState(null); // product whose variants are open
  const [variants, setVariants] = useState([]);
  const [variantForm, setVariantForm] = useState(null); // null | "new" | variant object
  const [vf, setVf] = useState({ name: "", sku: "", price: "", stock: "0", is_active: true });
  const [vsaving, setVsaving] = useState(false);
  const [vToDelete, setVToDelete] = useState(null);

  // Image gallery management state
  const [imageProduct, setImageProduct] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [imgFile, setImgFile] = useState(null);
  const [imgAlt, setImgAlt] = useState("");
  const [imgSaving, setImgSaving] = useState(false);
  const [imgToDelete, setImgToDelete] = useState(null);

  async function openVariants(product) {
    if (variantProduct?.id === product.id) { setVariantProduct(null); return; }
    setVariantProduct(product);
    setVariantForm(null);
    const data = await authFetch(`/variants/?product=${product.id}`).catch(() => ({ results: [] }));
    setVariants(data.results ?? data);
  }

  function openNewVariant() {
    setVf({ name: "", sku: "", price: "", stock: "0", is_active: true });
    setVariantForm("new");
  }

  function openEditVariant(v) {
    setVf({ name: v.name, sku: v.sku, price: v.price ?? "", stock: String(v.stock), is_active: v.is_active });
    setVariantForm(v);
  }

  async function saveVariant(e) {
    e.preventDefault();
    setVsaving(true);
    const payload = {
      product: variantProduct.id,
      name: vf.name,
      sku: vf.sku,
      price: vf.price || null,
      stock: vf.stock,
      is_active: vf.is_active,
    };
    try {
      if (variantForm === "new") {
        const created = await authFetch("/variants/", { method: "POST", body: JSON.stringify(payload) });
        setVariants((prev) => [...prev, created]);
      } else {
        const updated = await authFetch(`/variants/${variantForm.id}/`, { method: "PUT", body: JSON.stringify(payload) });
        setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      }
      setVariantForm(null);
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setVsaving(false);
    }
  }

  async function confirmDeleteVariant() {
    const v = vToDelete;
    setVToDelete(null);
    await authFetch(`/variants/${v.id}/`, { method: "DELETE" }).catch(() => {});
    setVariants((prev) => prev.filter((x) => x.id !== v.id));
  }

  async function openImages(product) {
    if (imageProduct?.id === product.id) { setImageProduct(null); return; }
    setImageProduct(product);
    setImgFile(null); setImgAlt("");
    const data = await authFetch(`/product-images/?product=${product.id}`).catch(() => ({ results: [] }));
    setGalleryImages(data.results ?? data);
  }

  async function uploadImage(e) {
    e.preventDefault();
    if (!imgFile) return;
    setImgSaving(true);
    const fd = new FormData();
    fd.append("product", imageProduct.id);
    fd.append("image", imgFile);
    if (imgAlt) fd.append("alt", imgAlt);
    try {
      const created = await authFetch("/product-images/", { method: "POST", body: fd });
      setGalleryImages((prev) => [...prev, created]);
      setImgFile(null); setImgAlt("");
    } catch (err) {
      setError(extractError(err.data, err.message));
    } finally {
      setImgSaving(false);
    }
  }

  async function confirmDeleteImage() {
    const img = imgToDelete;
    setImgToDelete(null);
    await authFetch(`/product-images/${img.id}/`, { method: "DELETE" }).catch(() => {});
    setGalleryImages((prev) => prev.filter((x) => x.id !== img.id));
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
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="search"
                    placeholder="Search by name or SKU"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search products"
                    style={{ minWidth: 200 }}
                  />
                  <button type="button" className="btn btn-ghost" onClick={() => handleExport("csv")} disabled={exportBusy}>
                    {exportBusy ? "Exporting…" : "Export CSV"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleExport("xlsx")} disabled={exportBusy}>
                    {exportBusy ? "Exporting…" : "Export Excel"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => importRef.current?.click()} disabled={importBusy}>
                    {importBusy ? "Importing…" : "Import"}
                  </button>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".csv,.xlsx"
                    style={{ display: "none" }}
                    onChange={handleImportFile}
                  />
                  <button type="button" className="btn btn-primary" onClick={openNew}>
                    + New product
                  </button>
                  {hasStockEdits && (
                    <button type="button" className="btn btn-ghost" onClick={handleBulkStock} disabled={savingStock}>
                      {savingStock ? "Saving…" : `Save stock changes (${Object.keys(stockEdits).length})`}
                    </button>
                  )}
                </div>
              </div>

              {importResult && (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: 6, background: importResult.errors?.length ? "#fef3c7" : "#d1fae5" }}>
                  <strong>Import result:</strong> {importResult.created} created, {importResult.updated} updated
                  {importResult.errors?.length > 0 && (
                    <ul style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                      {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {loading ? (
                <AdminTableSkeleton columns={7} rows={6} />
              ) : products.length === 0 ? (
                <p>{query ? `No products match "${query}".` : "No products yet."}</p>
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
                        <th>Flags</th>
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
                          <td>
                            {formatPrice(p.effective_price ?? p.price)}
                            {p.on_sale && p.sale_price && <span style={{ fontSize: "0.78em", opacity: 0.5, textDecoration: "line-through", marginLeft: "0.3rem" }}>{formatPrice(p.price)}</span>}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              value={stockEdits[p.id] ?? p.stock}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStockEdits((prev) => {
                                  if (val === "" || Number(val) === p.stock) {
                                    const { [p.id]: _, ...rest } = prev;
                                    return rest;
                                  }
                                  return { ...prev, [p.id]: val };
                                });
                              }}
                              style={{ width: 70, padding: "0.2rem 0.4rem", fontSize: "0.88rem" }}
                            />
                          </td>
                          <td>
                            <span className={p.is_active ? "product-stock" : "product-stock out"}>
                              {p.is_active ? "Active" : "Hidden"}
                            </span>
                          </td>
                          <td>
                            <span style={{ display: "flex", gap: "0.25rem", fontSize: "0.75em" }}>
                              {p.is_featured && <span className="product-stock" style={{ padding: "0.05rem 0.4rem", borderRadius: 4 }}>Featured</span>}
                              {p.is_new && <span className="product-stock" style={{ padding: "0.05rem 0.4rem", borderRadius: 4, background: "#dbeafe", color: "#1e40af" }}>New</span>}
                              {p.on_sale && <span className="product-stock" style={{ padding: "0.05rem 0.4rem", borderRadius: 4, background: "#fce7f3", color: "#9d174d" }}>Sale</span>}
                              {p.badge && <span className="product-stock" style={{ padding: "0.05rem 0.4rem", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>{p.badge}</span>}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button type="button" className="btn btn-ghost" onClick={() => openVariants(p)}>
                              Variants
                            </button>{" "}
                            <button type="button" className="btn btn-ghost" onClick={() => openImages(p)}>
                              Images
                            </button>{" "}
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

              {/* Inline variants panel */}
              {variantProduct && (
                <div className="order-card" style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h4 style={{ margin: 0 }}>Variants — {variantProduct.name}</h4>
                    <button className="btn btn-ghost" type="button" onClick={openNewVariant}>+ Add variant</button>
                  </div>

                  {variantForm && (
                    <form onSubmit={saveVariant} style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem", padding: "1rem", background: "var(--surface, #f9f9f9)", borderRadius: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <label>Name<input value={vf.name} onChange={e => setVf(p => ({...p, name: e.target.value}))} required placeholder="Large / Red" /></label>
                        <label>SKU<input value={vf.sku} onChange={e => setVf(p => ({...p, sku: e.target.value}))} required /></label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        <label>Price override <span style={{opacity:.5, fontSize:".8em"}}>(blank = base price)</span><input type="number" min="0" step="0.01" value={vf.price} onChange={e => setVf(p => ({...p, price: e.target.value}))} /></label>
                        <label>Stock<input type="number" min="0" value={vf.stock} onChange={e => setVf(p => ({...p, stock: e.target.value}))} required /></label>
                      </div>
                      <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                        <input type="checkbox" checked={vf.is_active} onChange={e => setVf(p => ({...p, is_active: e.target.checked}))} /> Active
                      </label>
                      <div style={{ display: "flex", gap: ".75rem" }}>
                        <button className="btn btn-primary" type="submit" disabled={vsaving}>{vsaving ? "Saving…" : "Save"}</button>
                        <button className="btn btn-ghost" type="button" onClick={() => setVariantForm(null)}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {variants.length === 0 ? (
                    <p style={{ opacity: .6, fontSize: ".88rem" }}>No variants yet.</p>
                  ) : (
                    <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: ".4rem .6rem" }}>Name</th>
                          <th style={{ textAlign: "left", padding: ".4rem .6rem" }}>SKU</th>
                          <th style={{ textAlign: "right", padding: ".4rem .6rem" }}>Price</th>
                          <th style={{ textAlign: "right", padding: ".4rem .6rem" }}>Stock</th>
                          <th style={{ textAlign: "right", padding: ".4rem .6rem" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v) => (
                          <tr key={v.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", opacity: v.is_active ? 1 : .5 }}>
                            <td style={{ padding: ".4rem .6rem" }}>{v.name}</td>
                            <td style={{ padding: ".4rem .6rem", fontFamily: "monospace" }}>{v.sku}</td>
                            <td style={{ padding: ".4rem .6rem", textAlign: "right" }}>{v.price ? `$${Number(v.price).toFixed(2)}` : "—"}</td>
                            <td style={{ padding: ".4rem .6rem", textAlign: "right" }}>{v.stock}</td>
                            <td style={{ padding: ".4rem .6rem", textAlign: "right", whiteSpace: "nowrap" }}>
                              <button className="btn btn-ghost" type="button" onClick={() => openEditVariant(v)}>Edit</button>{" "}
                              <button className="btn btn-danger" type="button" onClick={() => setVToDelete(v)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Inline images panel */}
              {imageProduct && (
                <div className="order-card" style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h4 style={{ margin: 0 }}>Gallery images — {imageProduct.name}</h4>
                  </div>
                  <form onSubmit={uploadImage} style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1.25rem" }}>
                    <label style={{ flex: 1, minWidth: 160 }}>
                      Image file
                      <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setImgFile(e.target.files?.[0] ?? null)} style={{ marginTop: ".3rem" }} />
                    </label>
                    <label style={{ flex: 1, minWidth: 140 }}>
                      Alt text <span style={{ opacity: .5, fontSize: ".8em" }}>(optional)</span>
                      <input value={imgAlt} onChange={e => setImgAlt(e.target.value)} placeholder="Descriptive text" style={{ marginTop: ".3rem" }} />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={imgSaving || !imgFile}>
                      {imgSaving ? "Uploading…" : "Upload"}
                    </button>
                  </form>
                  {galleryImages.length === 0 ? (
                    <p style={{ opacity: .6, fontSize: ".88rem" }}>No gallery images yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
                      {galleryImages.map((img) => (
                        <div key={img.id} style={{ position: "relative", width: 80, height: 80 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.image} alt={img.alt || ""} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)" }} />
                          <button
                            type="button"
                            onClick={() => setImgToDelete(img)}
                            style={{ position: "absolute", top: -6, right: -6, background: "var(--error, #dc2626)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 12, lineHeight: "20px", textAlign: "center", padding: 0 }}
                            aria-label="Delete image"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
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
              <div className="admin-form-row">
                <label className="admin-checkbox">
                  <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                  Featured
                </label>
                <label className="admin-checkbox">
                  <input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} />
                  New arrival
                </label>
                <label className="admin-checkbox">
                  <input type="checkbox" checked={form.on_sale} onChange={(e) => setForm({ ...form, on_sale: e.target.checked })} />
                  On sale
                </label>
              </div>
              <div className="admin-form-row">
                <label>
                  Sale price (USD)
                  <input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                </label>
                <label>
                  Custom badge
                  <input type="text" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="e.g. Clearance" />
                </label>
              </div>
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
      <ConfirmDialog
        open={!!vToDelete}
        title="Delete variant?"
        message={vToDelete ? `Delete variant "${vToDelete.name}"?` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteVariant}
        onCancel={() => setVToDelete(null)}
      />
      <ConfirmDialog
        open={!!imgToDelete}
        title="Delete image?"
        message="Permanently delete this gallery image?"
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteImage}
        onCancel={() => setImgToDelete(null)}
      />
    </>
  );
}
