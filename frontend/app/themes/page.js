import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata = {
  title: "Themes — Cartivo",
  description: "Beautiful storefront themes for your Cartivo shop.",
};

export default function ThemesPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "6rem 1rem" }}>
            <span className="eyebrow">Coming soon</span>
            <h2>Themes</h2>
            <p style={{ color: "var(--muted)", maxWidth: 480, margin: "1rem auto 0" }}>
              We're crafting a collection of beautiful, customizable storefront themes.
              Check back soon — or join early access to be the first to know.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
