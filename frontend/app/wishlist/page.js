"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useWishlist } from "../lib/wishlist";
import { useCart } from "../lib/cart";
import { useToast } from "../lib/toast";
import { formatPrice } from "../lib/format";
import { ProductGridSkeleton } from "../components/Skeleton";

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, removeById } = useWishlist();
  const { addItem } = useCart();
  const toast = useToast();
  const [busy, setBusy] = useState(null); // wishlist item id currently mutating

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

            {!user && !authLoading ? (
              <div className="cart-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <p>Sign in to see your saved items.</p>
                <Link href="/login" className="btn btn-primary">Sign in</Link>
              </div>
            ) : loading || authLoading ? (
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
