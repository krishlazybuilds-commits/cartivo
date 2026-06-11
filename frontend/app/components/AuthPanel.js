import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "../lib/api";

/**
 * Right-hand decorative panel for all auth pages.
 * Fetches 4 featured products at build/request time and shows them in a
 * staggered floating grid over the brand navy background.
 */
export default async function AuthPanel() {
  let products = [];
  try {
    const data = await apiFetch("/products/?page_size=4&ordering=-created_at", {
      next: { revalidate: 3600, tags: ["products"] },
    });
    products = (data.results ?? data).slice(0, 4);
  } catch {
    products = [];
  }

  // Pick 4 — fill with placeholders if fewer available
  const cards = [0, 1, 2, 3].map((i) => products[i] ?? null);

  return (
    <div className="auth-panel" aria-hidden="true">
      {/* Animated ambient orbs behind the cards */}
      <div className="auth-panel-orb auth-panel-orb--1" />
      <div className="auth-panel-orb auth-panel-orb--2" />
      <div className="auth-panel-orb auth-panel-orb--3" />

      {/* Staggered product cards */}
      <div className="auth-panel-grid">
        {cards.map((p, i) => (
          <div
            key={i}
            className={`auth-panel-card auth-panel-card--${i + 1}`}
          >
            {p?.image ? (
              <Image
                src={p.image}
                alt={p.name}
                width={180}
                height={140}
                className="auth-panel-img"
              />
            ) : (
              <span className="auth-panel-ph" aria-hidden="true">
                {p?.name?.[0] ?? "C"}
              </span>
            )}
            {p && (
              <div className="auth-panel-card-info">
                <span className="auth-panel-card-name">{p.name}</span>
                <span className="auth-panel-card-price">
                  ${Number(p.price).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Brand mark pinned to bottom */}
      <div className="auth-panel-brand">
        <Link href="/" className="brand auth-panel-brandmark">
          <span className="brand-dot" style={{ background: "var(--accent)", color: "var(--ink)" }}>C</span>
          <span style={{ color: "#fff" }}>Cartivo</span>
        </Link>
        <p className="auth-panel-tagline">
          Shop the latest tech.<br />Fast checkout. Real products.
        </p>
      </div>
    </div>
  );
}
