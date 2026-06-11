"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
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
      <Nav />
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
              <p className="center">
                Please <Link href="/login">sign in</Link> to view your wishlist.
              </p>
            ) : loading || authLoading ? (
              <ProductGridSkeleton />
            ) : items.length === 0 ? (
              <p className="center">
                Your wishlist is empty. <Link href="/products">Browse the shop</Link> and tap the
                heart to save items.
              </p>
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
      <Footer />
    </>
  );
}
