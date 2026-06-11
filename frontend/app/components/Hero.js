import Link from "next/link";
import Image from "next/image";
import Icon from "./Icon";
import Reveal from "./Reveal";
import { apiFetch } from "../lib/api";

async function getCategories() {
  try {
    const data = await apiFetch("/categories/", {
      next: { revalidate: 3600, tags: ["categories"] },
    });
    return (data.results ?? data).slice(0, 6);
  } catch {
    return [];
  }
}

export default async function Hero() {
  const categories = await getCategories();

  return (
    <header className="hero hero--dark" id="top">
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal as="span" className="eyebrow">
            Premium tech, fair prices
          </Reveal>
          <Reveal as="h1" delay={60}>
            Sound, vision and <span className="accent">everyday tech</span>.
          </Reveal>
          <Reveal as="p" className="lead" delay={120}>
            Headphones, smartphones, wearables and accessories — a curated catalog,
            in stock and delivered fast, with secure checkout and shipping shown
            upfront.
          </Reveal>
          <Reveal className="hero-actions" delay={180}>
            <Link href="/products" className="btn btn-primary">
              Shop now
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link href="/categories" className="btn btn-light">
              Browse categories
            </Link>
          </Reveal>

          {categories.length > 0 && (
            <Reveal className="hero-cats" delay={240}>
              <span className="hero-cats-label">Shop by category</span>
              <div className="hero-cats-list">
                {categories.map((c) => (
                  <Link key={c.id} href={`/categories/${c.slug}`} className="hero-cat-chip">
                    {c.name}
                  </Link>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        <Reveal className="hero-visual" delay={160}>
          <div className="hero-image-wrap">
            <Image
              src="/hero-model.png"
              alt="A person enjoying premium headphones and everyday tech"
              width={760}
              height={760}
              priority
              className="hero-image"
            />
          </div>
        </Reveal>
      </div>
    </header>
  );
}
