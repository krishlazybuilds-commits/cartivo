"use client";

import Link from "next/link";
import Footer from "../../components/Footer";

export default function ProductDetailError({ error, reset }) {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h2>Product not found</h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              {error?.message || "We couldn't load this product."}
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={reset}>
                Try again
              </button>
              <Link href="/products" className="btn btn-ghost">
                Back to shop
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
