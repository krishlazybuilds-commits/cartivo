"use client";

import Nav from "./components/Nav";
import Footer from "./components/Footer";

export default function GlobalError({ error, reset }) {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h2>Something went wrong</h2>
            <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              {error?.message || "An unexpected error occurred."}
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
