"use client";

import Footer from "../components/Footer";

export default function ProductsError({ error, reset }) {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h2>Failed to load products</h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              {error?.message || "Something went wrong loading the catalog."}
            </p>
            <button
              className="btn btn-primary"
              onClick={reset}
              style={{ marginTop: "1.5rem" }}
            >
              Try again
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
