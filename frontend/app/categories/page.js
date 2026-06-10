import Link from "next/link";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { apiFetch } from "../lib/api";

export const metadata = {
  title: "Categories — Cartivo",
  description: "Browse Cartivo product categories.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let categories = [];
  let error = null;
  try {
    const data = await apiFetch("/categories/");
    categories = data.results ?? data;
  } catch (e) {
    error = e.message;
  }

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Browse</span>
                <h2>Categories</h2>
                <p>Explore products by category.</p>
              </div>
            </Reveal>

            {error && (
              <p className="center" role="alert">
                Something went wrong loading categories. Please try again in a moment.
              </p>
            )}

            {!error && categories.length === 0 && (
              <p className="center">No categories yet.</p>
            )}

            <div className="feature-grid">
              {categories.map((c, i) => (
                <Reveal key={c.id} delay={i * 60}>
                  <Link className="feature-card" href={`/categories/${c.slug}`}>
                    <h3>{c.name}</h3>
                    {c.description && <p>{c.description}</p>}
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
