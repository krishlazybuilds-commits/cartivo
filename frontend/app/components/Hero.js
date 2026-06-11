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
    <header className="hero-cinematic" id="top">
      <div className="hero-stage">
        <Image
          src="/hero-model.png"
          alt="A person enjoying premium headphones and everyday tech"
          fill
          priority
          sizes="100vw"
          className="hero-bg"
        />
        <div className="hero-stage-overlay" aria-hidden="true" />

        <div className="hero-stage-content">
          <Reveal as="span" className="eyebrow">
            Premium tech, fair prices
          </Reveal>
          <Reveal as="h1" delay={60}>
            Sound, vision and <span className="accent">everyday tech</span>.
          </Reveal>
          <Reveal as="p" className="lead" delay={120}>
            A curated catalog of headphones, phones, wearables and accessories —
            in stock and delivered fast.
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
            <Reveal className="hero-stage-cats" delay={240}>
              {categories.map((c) => (
                <Link key={c.id} href={`/categories/${c.slug}`} className="hero-cat-chip">
                  {c.name}
                </Link>
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </header>
  );
}
