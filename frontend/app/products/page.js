import Link from "next/link";
import Image from "next/image";
import ShopFilters from "../components/ShopFilters";
import Reveal from "../components/Reveal";
import WishlistButton from "../components/WishlistButton";
import StarRating from "../components/StarRating";
import { apiFetch } from "../lib/api";
import { formatPrice } from "../lib/format";

export const metadata = {
  title: "Shop — Cartivo",
  description: "Browse the Cartivo catalog.",
  alternates: {
    canonical: "/products",
  },
};

export default async function ProductsPage({ searchParams }) {
  const category = searchParams?.category ?? "";
  const search = searchParams?.search ?? "";
  const page = searchParams?.page ?? "";
  const ordering = searchParams?.ordering ?? "";

  let products = [];
  let categories = [];
  let count = 0;
  let error = null;

  // Build the filtered query string for the products endpoint.
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (search) query.set("search", search);
  if (ordering) query.set("ordering", ordering);
  if (page) query.set("page", page);
  const qs = query.toString();

  try {
    const [productData, categoryData] = await Promise.all([
      apiFetch(`/products/${qs ? `?${qs}` : ""}`, { next: { tags: ["products"] } }),
      apiFetch("/categories/", { next: { tags: ["categories"] } }),
    ]);
    products = productData.results ?? productData;
    categories = categoryData.results ?? categoryData;
    count = productData.count ?? products.length;
  } catch (e) {
    error = e.message;
  }

  const pageSize = 20;
  const currentPage = parseInt(page || "1", 10);
  const totalPages = Math.ceil(count / pageSize);

  function pageUrl(p) {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (search) q.set("search", search);
    if (ordering) q.set("ordering", ordering);
    if (p > 1) q.set("page", p);
    const qs = q.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Shop</span>
                <h2>Browse the catalog</h2>
                <p>Live products served from the Cartivo API.</p>
              </div>
            </Reveal>

            <ShopFilters
              categories={categories}
              activeCategory={category}
              activeSearch={search}
              activeSort={ordering}
            />

            {error && (
              <p className="center" role="alert">
                Something went wrong loading the shop. Please try again in a moment.
              </p>
            )}

            {!error && products.length === 0 && (
              <div className="empty-state">
                <svg className="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p>
                  {search || category
                    ? "No products match your filters."
                    : "No products yet."}
                </p>
              </div>
            )}

            <div className="feature-grid">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 30}>
                  <Link className="feature-card product-card" href={`/products/${p.slug}`}>
                    <div className="product-image">
                      {p.image ? (
                        <Image src={p.image} alt={p.name} width={400} height={300} className="product-img" />
                      ) : (
                        <span className="product-image-ph" aria-hidden="true">
                          {p.name?.[0] ?? "?"}
                        </span>
                      )}
                      <WishlistButton productId={p.id} className="product-card-wishlist" />
                    </div>
                    <span className="product-cat">{p.category_name ?? "Product"}</span>
                    <h3>{p.name}</h3>
                    {p.review_count > 0 && (
                      <StarRating value={p.avg_rating ?? 0} count={p.review_count} size="0.85rem" />
                    )}
                    <p>{p.description}</p>
                    <div className="product-meta">
                      <span className="product-price">{formatPrice(p.price)}</span>
                      <span className={p.in_stock ? "product-stock" : "product-stock out"}>
                        {p.in_stock ? "In stock" : "Out of stock"}
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)} className="btn btn-ghost">← Prev</Link>
                ) : (
                  <span className="btn btn-ghost" aria-disabled="true" style={{ opacity: 0.4 }}>← Prev</span>
                )}
                <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                {currentPage < totalPages ? (
                  <Link href={pageUrl(currentPage + 1)} className="btn btn-ghost">Next →</Link>
                ) : (
                  <span className="btn btn-ghost" aria-disabled="true" style={{ opacity: 0.4 }}>Next →</span>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
