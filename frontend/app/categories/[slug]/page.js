import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import Reveal from "../../components/Reveal";
import Breadcrumbs from "../../components/Breadcrumbs";
import { apiFetch } from "../../lib/api";
import { formatPrice } from "../../lib/format";

export async function generateMetadata({ params }) {
  try {
    const category = await apiFetch(`/categories/${params.slug}/`, {
      next: { tags: ["categories", `category-${params.slug}`] },
    });
    const title = `${category.name} — Cartivo`;
    const description = category.description?.slice(0, 155) || `Browse ${category.name} products on Cartivo.`;
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return {
      title,
      description,
      alternates: {
        canonical: `/categories/${params.slug}`,
      },
      openGraph: {
        title,
        description,
        type: "website",
        url: `${SITE_URL}/categories/${params.slug}`,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return { title: "Category — Cartivo" };
  }
}

export default async function CategoryPage({ params }) {
  let category;
  try {
    category = await apiFetch(`/categories/${params.slug}/`, {
      next: { tags: ["categories", `category-${params.slug}`] },
    });
  } catch (e) {
    if (String(e.message).includes("404")) notFound();
    throw e;
  }

  let products = [];
  let error = null;
  try {
    const data = await apiFetch(`/products/?category=${category.id}`, {
      next: { tags: ["products", `category-${params.slug}`] },
    });
    products = data.results ?? data;
  } catch (e) {
    error = e.message;
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Categories", href: "/categories" },
                { label: category.name },
              ]}
            />

            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Category</span>
                <h2>{category.name}</h2>
                {category.description && <p>{category.description}</p>}
              </div>
            </Reveal>

            {error && (
              <p className="center" role="alert">
                Something went wrong loading this category. Please try again in a moment.
              </p>
            )}

            {!error && products.length === 0 && (
              <p className="center">No products in this category yet.</p>
            )}

            <div className="feature-grid">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <Link className="feature-card product-card" href={`/products/${p.slug}`}>
                    <div className="product-image">
                      {p.image ? (
                        <Image src={p.image} alt={p.name} width={400} height={300} className="product-img" />
                      ) : (
                        <span className="product-image-ph" aria-hidden="true">
                          {p.name?.[0] ?? "?"}
                        </span>
                      )}
                    </div>
                    <span className="product-cat">{p.category_name ?? "Product"}</span>
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                    <div className="product-meta">
                      <span className="product-price">{formatPrice(p.price)}</span>
                      <span className={p.in_stock ? "product-stock" : "product-stock out"}>
                        {p.in_stock ? "In stock" : "Out of stock"}
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
