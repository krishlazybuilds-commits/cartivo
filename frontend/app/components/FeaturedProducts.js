import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "../lib/api";
import { formatPrice } from "../lib/format";

export default async function FeaturedProducts() {
  let products = [];
  try {
    const data = await apiFetch("/products/?ordering=-created_at");
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
            <Link className="feature-card product-card" key={p.id} href={`/products/${p.slug}`}>
              <div className="product-image">
                {p.image ? (
                  <Image src={p.image} alt={p.name} width={400} height={300} className="product-img" />
                ) : (
                  <span className="product-image-ph" aria-hidden="true">{p.name?.[0] ?? "?"}</span>
                )}
              </div>
              <span className="product-cat">{p.category_name ?? "Product"}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="product-meta">
                <span className="product-price">{formatPrice(p.price)}</span>
                <span className={p.in_stock ? "product-stock" : "product-stock out"}>
                  {p.in_stock ? "In stock" : "Out of stock"}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <Link href="/products" className="btn btn-ghost">View all products</Link>
        </div>
      </div>
    </section>
  );
}
