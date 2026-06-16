import Image from "next/image";
import Link from "next/link";

import Reveal from "../components/Reveal";
import { apiFetch } from "../lib/api";
import { formatPrice } from "../lib/format";

export async function generateMetadata(props) {
  const searchParams = await props.searchParams;
  const q = searchParams?.q ?? "";
  return { title: q ? `"${q}" — Cartivo` : "Search — Cartivo" };
}

export default async function SearchPage(props) {
  const searchParams = await props.searchParams;
  const q = (searchParams?.q ?? "").trim();
  let products = [];
  let total = 0;

  if (q) {
    try {
      const data = await apiFetch(`/products/?search=${encodeURIComponent(q)}&is_active=true`, {
        next: { revalidate: 30 },
      });
      products = data.results ?? data;
      total = data.count ?? products.length;
    } catch {
      products = [];
    }
  }

  return (
    <main>
      <section className="features">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Search</span>
              <h2>{q ? `Results for "${q}"` : "Search products"}</h2>
              {q && <p>{total} result{total !== 1 ? "s" : ""}</p>}
            </div>
          </Reveal>

          {!q && (
            <p>Use the search bar in the navigation to find products.</p>
          )}

          {q && products.length === 0 && (
            <p>No products found for <strong>{q}</strong>. Try a different term or <Link href="/products">browse the shop</Link>.</p>
          )}

          {products.length > 0 && (
            <div className="products-grid">
              {products.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="product-card">
                  <div className="product-image-wrap">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} width={300} height={300} className="product-img" />
                    ) : (
                      <span className="product-image-ph" aria-hidden="true">{p.name?.[0] ?? "?"}</span>
                    )}
                  </div>
                  <div className="product-info">
                    <span className="product-cat">{p.category_name}</span>
                    <h3 className="product-name">{p.name}</h3>
                    <div className="product-meta">
                      <span className="product-price">{formatPrice(p.price)}</span>
                      <span className={p.in_stock ? "product-stock" : "product-stock out"}>
                        {p.in_stock ? "In stock" : "Out of stock"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
