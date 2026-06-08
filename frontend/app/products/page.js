import Nav from "../components/Nav";
import Footer from "../components/Footer";
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

export default async function ProductsPage() {
  let products = [];
  let error = null;

  try {
    const data = await apiFetch("/products/");
    products = data.results ?? data; // handle paginated or plain list
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

            {error && (
              <p className="center" role="alert">
                Couldn&apos;t load products: {error}
              </p>
            )}

            {!error && products.length === 0 && (
              <p className="center">No products yet.</p>
            )}

            <div className="feature-grid">
              {products.map((p) => (
                <article className="feature-card" key={p.id}>
                  <span className="product-cat">{p.category_name ?? "Product"}</span>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="product-meta">
                    <span className="product-price">{formatPrice(p.price)}</span>
                    <span className={p.in_stock ? "product-stock" : "product-stock out"}>
                      {p.in_stock ? "In stock" : "Out of stock"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
