"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import { getRecentlyViewed, clearRecentlyViewed } from "../lib/recentlyViewed";
import { ProductGridSkeleton } from "./Skeleton";
import ProductCard from "./ProductCard";

export default function RecentlyViewed() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getRecentlyViewed();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    const idList = ids.map((p) => p.id).join(",");
    apiFetch(`/products/?ids=${idList}&page_size=10`, { cache: "no-store" })
      .then((data) => {
        const fetched = (data?.results ?? data ?? []).filter(Boolean);
        // Preserve the order from localStorage (newest first)
        const ordered = ids
          .map((p) => fetched.find((f) => f.id === p.id))
          .filter(Boolean);
        setProducts(ordered);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProductGridSkeleton count={4} />;
  if (products.length === 0) return null;

  return (
    <section className="features" style={{ marginTop: "3rem" }}>
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Continue browsing</span>
          <h2>Recently viewed</h2>
        </div>

        <div className="feature-grid">
          {products.slice(0, 6).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: "0.85rem", cursor: "pointer", border: "none", background: "none", color: "var(--muted)", textDecoration: "underline" }}
            onClick={() => { clearRecentlyViewed(); setProducts([]); }}
          >
            Clear history
          </button>
        </div>
      </div>
    </section>
  );
}
