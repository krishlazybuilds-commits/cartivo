"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useWishlist } from "../lib/wishlist";
import { useCart } from "../lib/cart";
import { useToast } from "../lib/toast";
import { formatPrice } from "../lib/format";
import { ProductGridSkeleton } from "../components/Skeleton";
import { API_URL } from "../lib/api";

/**
 * Page component rendering the user's wishlist.
 * Supports displaying guest wishlist items stored in localStorage when unauthenticated.
 *
 * @returns {JSX.Element} The rendered wishlist page.
 */
export default function WishlistPage() {
  return (
    <Suspense fallback={<main><section className="features"><div className="container"><ProductGridSkeleton /></div></section></main>}>
      <WishlistContent />
    </Suspense>
  );
}

function WishlistContent() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, removeById } = useWishlist();
  const { addItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const searchParams = useSearchParams();

  // Shared-view mode: ?products=id1,id2
  const sharedIds = searchParams.get("products")?.split(",").filter(Boolean) ?? [];
  const isSharedView = sharedIds.length > 0;
  const [sharedProducts, setSharedProducts] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(isSharedView);

  useEffect(() => {
    if (!isSharedView) return;
    (async () => {
      setSharedLoading(true);
      try {
        const res = await fetch(`${API_URL}/products/?ids=${sharedIds.join(",")}`);
        const data = await res.json();
        setSharedProducts(data.results ?? data);
      } catch {
        setSharedProducts([]);
      } finally {
        setSharedLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleShare() {
    const ids = items.map((i) => i.product).join(",");
    const url = `${window.location.origin}/wishlist?products=${ids}`;
    navigator.clipboard.writeText(url).then(
      () => toast("Share link copied to clipboard!", "success"),
      () => toast("Couldn't copy link", "error"),
    );
  }

  function handleExport() {
    const text = items.map((i) => `${i.product_name} — ${formatPrice(i.product_price)}`).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast("Wishlist copied to clipboard!", "success"),
      () => toast("Couldn't copy list", "error"),
    );
  }

  async function handleRemove(itemId) {
    setBusy(itemId);
    try {
      await removeById(itemId);
      toast("Removed from wishlist", "info");
    } catch {
      toast("Couldn't remove item", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleMoveToCart(item) {
    setBusy(item.id);
    try {
      await addItem(item.product, 1, {
        name: item.product_name,
        price: Number(item.product_price),
      });
      await removeById(item.id);
      toast("Moved to cart", "success");
    } catch (err) {
      toast(err.message || "Couldn't move to cart", "error");
    } finally {
      setBusy(null);
    }
  }

  // Shared-view render
  if (isSharedView) {
    return (
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Shared wishlist</span>
                <h2>Someone shared their favourites</h2>
              </div>
            </Reveal>
            {sharedLoading ? (
              <ProductGridSkeleton />
            ) : sharedProducts.length === 0 ? (
              <p className="reviews-note">No products found.</p>
            ) : (
              <div className="feature-grid">
                {sharedProducts.map((p) => (
                  <article key={p.id} className="feature-card product-card">
                    <Link href={`/products/${p.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
                      <div className="product-image">
                        {p.image ? (
                          <Image src={p.image} alt={p.name} width={400} height={300} className="product-img" />
                        ) : (
                          <span className="product-image-ph" aria-hidden="true">{p.name?.[0] ?? "?"}</span>
                        )}
                      </div>
                      <h3>{p.name}</h3>
                      <div className="product-meta">
                        <span className="product-price">{formatPrice(p.effective_price ?? p.price)}</span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Your wishlist</span>
                <h2>Saved for later</h2>
              </div>
            </Reveal>

            {!(loading || authLoading) && items.length > 0 && (
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginBottom: "1.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={handleShare}>
                  Share link
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleExport}>
                  Copy list
                </button>
              </div>
            )}

            {loading || authLoading ? (
              <ProductGridSkeleton />
            ) : items.length === 0 ? (
              <div className="cart-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <p>Your wishlist is empty.</p>
                <Link href="/products" className="btn btn-primary">Browse the shop</Link>
              </div>
            ) : (
              <div className="feature-grid">
                {items.map((item, i) => (
                  <Reveal key={item.id} delay={i * 60}>
                    <article className="feature-card product-card wishlist-card">
                      <Link href={`/products/${item.product_slug}`} className="wishlist-card-link">
                        <div className="product-image">
                          {item.product_image ? (
                            <Image
                              src={item.product_image}
                              alt={item.product_name}
                              width={400}
                              height={300}
                              className="product-img"
                            />
                          ) : (
                            <span className="product-image-ph" aria-hidden="true">
                              {item.product_name?.[0] ?? "?"}
                            </span>
                          )}
                        </div>
                        <h3>{item.product_name}</h3>
                        <div className="product-meta">
                          <span className="product-price">{formatPrice(item.product_price)}</span>
                        </div>
                      </Link>
                      <div className="wishlist-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleMoveToCart(item)}
                          disabled={busy === item.id}
                        >
                          {busy === item.id ? "…" : "Move to cart"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleRemove(item.id)}
                          disabled={busy === item.id}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
