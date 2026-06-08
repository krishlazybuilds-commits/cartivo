import Link from "next/link";
import { notFound } from "next/navigation";

import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { apiFetch } from "../../lib/api";

export const dynamic = "force-dynamic";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export async function generateMetadata({ params }) {
  try {
    const product = await apiFetch(`/products/${params.slug}/`);
    return {
      title: `${product.name} — Cartivo`,
      description: product.description?.slice(0, 150) || "Cartivo product",
    };
  } catch {
    return { title: "Product — Cartivo" };
  }
}

export default async function ProductDetailPage({ params }) {
  let product;
  try {
    product = await apiFetch(`/products/${params.slug}/`);
  } catch (e) {
    // A 404 from the API means the product doesn't exist.
    if (String(e.message).includes("404")) notFound();
    throw e;
  }

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <p className="product-back">
              <Link href="/products">← Back to shop</Link>
            </p>

            <article className="product-detail">
              <span className="product-cat">{product.category_name ?? "Product"}</span>
              <h1>{product.name}</h1>
              <div className="product-meta">
                <span className="product-price">{formatPrice(product.price)}</span>
                <span
                  className={product.in_stock ? "product-stock" : "product-stock out"}
                >
                  {product.in_stock ? `In stock (${product.stock})` : "Out of stock"}
                </span>
              </div>
              <p className="product-desc">{product.description}</p>
              <p className="product-sku">SKU: {product.sku}</p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
