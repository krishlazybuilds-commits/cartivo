"use client";

import Link from "next/link";
import Footer from "../../components/Footer";

export default function OrderDetailError({ error, reset }) {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h2>Failed to load order</h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              {error?.message || "We couldn't load this order."}
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={reset}>
                Try again
              </button>
              <Link href="/orders" className="btn btn-ghost">
                Back to orders
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
