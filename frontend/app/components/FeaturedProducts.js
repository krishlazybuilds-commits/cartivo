import Link from "next/link";
import { apiFetch } from "../lib/api";
import ProductCard from "./ProductCard";

export default async function FeaturedProducts() {
  let products = [];
  try {
    const data = await apiFetch("/products/?is_featured=true&ordering=-created_at");
    products = (data.results ?? data).slice(0, 3);
  } catch {
    return null;
  }

  if (!products.length) return null;

  return (
    <section className="features">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Featured</span>
          <h2>Popular products</h2>
          <p>Handpicked items from our catalog.</p>
        </div>

        <div className="feature-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <Link href="/products" className="btn btn-ghost">View all products</Link>
        </div>
      </div>
    </section>
  );
}
