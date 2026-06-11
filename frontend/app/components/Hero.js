import Link from "next/link";
import Image from "next/image";
import Icon from "./Icon";
import Reveal from "./Reveal";
import { apiFetch } from "../lib/api";
import { formatPrice } from "../lib/format";

async function getFeatured() {
  try {
    const data = await apiFetch("/products/?ordering=-created_at&page_size=4", {
      next: { revalidate: 3600, tags: ["products"] },
    });
    return (data.results ?? data).slice(0, 4);
  } catch {
    return [];
  }
}

export default async function Hero() {
  const products = await getFeatured();
  const main = products[0];
  const mini = products[1];

  return (
    <header className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal as="span" className="eyebrow">
            Premium tech, fair prices
          </Reveal>
          <Reveal as="h1" delay={60}>
            Shop the latest <span className="accent">tech</span>, delivered fast.
          </Reveal>
          <Reveal as="p" className="lead" delay={120}>
            Laptops, smartphones, audio, wearables and more — browse a curated
            catalog with secure checkout, guest ordering, and shipping costs
            shown upfront.
          </Reveal>
          <Reveal className="hero-actions" delay={180}>
            <Link href="/products" className="btn btn-primary">
              Shop now
              <Icon name="arrowRight" size={18} />
            </Link>
            <a href="#categories" className="btn btn-ghost">
              Browse categories
            </a>
          </Reveal>
          <Reveal className="hero-trust" delay={240}>
            <Icon name="check" size={16} />
            Secure Stripe checkout
            <span className="dot-sep" aria-hidden="true">
              ·
            </span>
            No account required
          </Reveal>
        </div>

        <Reveal className="hero-visual" delay={160}>
          {main ? (
            <Link href={`/products/${main.slug}`} className="hero-showcase">
              <div className="hero-showcase-media">
                {main.image ? (
                  <Image
                    src={main.image}
                    alt={main.name}
                    width={460}
                    height={345}
                    priority
                  />
                ) : (
                  <span className="hero-showcase-ph">{main.name?.[0] ?? "?"}</span>
                )}
              </div>
              <div className="hero-showcase-body">
                <span className="hero-showcase-cat">{main.category_name ?? "Featured"}</span>
                <h3>{main.name}</h3>
                <div className="hero-showcase-meta">
                  <span className="hero-showcase-price">{formatPrice(main.price)}</span>
                  <span className={`hero-showcase-stock${main.in_stock ? "" : " out"}`}>
                    {main.in_stock ? "In stock" : "Sold out"}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="hero-showcase" />
          )}

          {mini && (
            <Link href={`/products/${mini.slug}`} className="float-card fc-1 hero-mini">
              <div className="hero-mini-media">
                {mini.image ? (
                  <Image src={mini.image} alt={mini.name} width={44} height={44} />
                ) : (
                  <span aria-hidden="true">{mini.name?.[0] ?? "?"}</span>
                )}
              </div>
              <div>
                <small>{mini.name}</small>
                <strong>{formatPrice(mini.price)}</strong>
              </div>
            </Link>
          )}

          <div className="float-card fc-2">
            <div className="ic">
              <Icon name="truck" size={20} />
            </div>
            <div>
              <small>Free shipping</small>
              <strong>On orders over $500</strong>
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
