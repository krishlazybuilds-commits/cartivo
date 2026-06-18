import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "../lib/api";
import { formatPrice } from "../lib/format";

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
            <Link className="feature-card product-card" key={p.id} href={`/products/${p.slug}`}>
              <div className="product-image" style={{ position: "relative" }}>
                {p.image ? (
                  <Image src={p.image} alt={p.name} width={400} height={300} className="product-img" />
                ) : (
                  <span className="product-image-ph" aria-hidden="true">{p.name?.[0] ?? "?"}</span>
                )}
                {(p.display_badge) && (
                  <span style={{
                    position: "absolute", top: "0.5rem", left: "0.5rem",
                    background: p.on_sale ? "#e11d48" : p.is_new ? "#2563eb" : "#111",
                    color: "#fff", fontSize: "0.7rem", fontWeight: 600,
                    padding: "0.15rem 0.55rem", borderRadius: 4, zIndex: 2,
                  }}>
                    {p.display_badge}
                  </span>
                )}
              </div>
              <span className="product-cat">{p.category_name ?? "Product"}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="product-meta">
                <span className="product-price">
                  {formatPrice(p.effective_price ?? p.price)}
                  {p.on_sale && p.sale_price && (
                    <span style={{ fontSize: "0.78em", opacity: 0.5, textDecoration: "line-through", marginLeft: "0.3rem" }}>
                      {formatPrice(p.price)}
                    </span>
                  )}
                </span>
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
