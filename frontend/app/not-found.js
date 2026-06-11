import Link from "next/link";
import Footer from "./components/Footer";

export default function NotFound() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "80px 24px" }}>
            <span className="eyebrow">404</span>
            <h2 style={{ margin: "16px 0 14px" }}>Page not found</h2>
            <p style={{ color: "var(--slate)", marginBottom: "2rem" }}>
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" className="btn btn-primary">Go home</Link>
              <Link href="/products" className="btn btn-ghost">Browse shop</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
