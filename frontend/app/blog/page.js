import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata = {
  title: "Blog — Cartivo",
  description: "Tips, updates, and stories from the Cartivo team.",
};

export default function BlogPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "6rem 1rem" }}>
            <span className="eyebrow">Coming soon</span>
            <h2>Blog</h2>
            <p style={{ color: "var(--muted)", maxWidth: 480, margin: "1rem auto 0" }}>
              We&apos;re working on guides, product updates, and merchant stories.
              The blog will launch soon — stay tuned.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
