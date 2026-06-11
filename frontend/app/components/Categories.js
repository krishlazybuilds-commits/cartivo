import Link from "next/link";
import Icon from "./Icon";
import { apiFetch } from "../lib/api";

// Map category slugs to an icon from our set for a consistent visual language.
const CATEGORY_ICONS = {
  laptops: "chart",
  audio: "message",
  smartphones: "zap",
  wearables: "heart",
  "tv-streaming": "play",
  accessories: "tag",
};

export default async function Categories() {
  let categories = [];
  try {
    const data = await apiFetch("/categories/");
    categories = data.results ?? data;
  } catch {
    return null;
  }

  if (!categories.length) return null;

  return (
    <section id="categories">
      <div className="container">
        <div className="section-head center">
          <span className="eyebrow">Browse</span>
          <h2>Shop by category</h2>
          <p>Find exactly what you&apos;re looking for across our catalog.</p>
        </div>

        <div className="category-grid">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.id}`}
              className="category-card"
            >
              <span className="category-icon">
                <Icon name={CATEGORY_ICONS[c.slug] || "tag"} size={26} />
              </span>
              <h3>{c.name}</h3>
              {c.description && <p>{c.description}</p>}
              <span className="category-link">
                Shop {c.name}
                <Icon name="arrowRight" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
