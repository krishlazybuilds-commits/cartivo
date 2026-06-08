import Link from "next/link";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import ShopFilters from "../components/ShopFilters";
import { apiFetch } from "../lib/api";

export const metadata = {
  title: "Shop — Cartivo",
  description: "Browse the Cartivo catalog.",
};

// Always fetch fresh data from the API (no static caching).
export const dynamic = "force-dynamic";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export default async function ProductsPage({ searchParams }) {
  const category = searchParams?.category ?? "";
  const search = searchParams?.search ?? "";

  let products = [];
  let categories = [];
  let error = null;

  // Build the filtered query string for the products endpoint.
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (search) query.set("search", search);
  const qs = query.toString();

  try {
    const [productData, categoryData] = await Promise.all([
      apiFetch(`/products/${qs ? `?${qs}` : ""}`),
      apiFetch("/categories/"),
    ]);
    products = productData.results ?? productData;
    categories = categoryData.results ?? categoryData;
  } catch (e) {
    error = e.message;
  }

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow">Shop</span>
              <h2>Browse the catalog</h2>
              <p>Live products served from the Cartivo API.</p>
            </div>

            <ShopFilters
              categories={categories}
              activeCategory={category}
              activeSearch={search}
            />

            {error && (
              <p className="center" role="alert">
                Couldn&apos;t load products: {error}
              </p>
            )}

            {!error && products.length === 0 && (
              <p className="center">
                {search || category
                  ? "No products match your filters."
                  : "No products yet."}
              </p>
            )}

            <div className="feature-grid">
              {products.map((p) => (
                <Link className="feature-card product-card" key={p.id} href={`/products/${p.slug}`}>
                  <div className="product-image">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} />
                    ) : (
                      <span className="product-image-ph" aria-hidden="true">
                        {p.name?.[0] ?? "?"}
                      </span>
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
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
