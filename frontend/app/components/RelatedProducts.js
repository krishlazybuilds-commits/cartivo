"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { ProductGridSkeleton } from "./Skeleton";
import ProductCard from "./ProductCard";

export default function RelatedProducts({ product }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!product?.slug) {
      setLoading(false);
      return;
    }
    apiFetch(`/products/${product.slug}/related/`, { cache: "no-store" })
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [product?.slug]);

  if (loading) return <ProductGridSkeleton count={4} />;
  if (products.length === 0) return null;

  return (
    <section className="features" style={{ marginTop: "3rem" }}>
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">You might also like</span>
          <h2>Related products</h2>
        </div>

        <div className="feature-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
