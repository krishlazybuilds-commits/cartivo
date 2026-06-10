"use client";

import Link from "next/link";
import { useState } from "react";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { CartSkeleton } from "../components/Skeleton";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const [error, setError] = useState(null);

  // Wrap a cart action so any error (e.g. exceeding stock) surfaces to the user.
  async function run(action) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  if (authLoading) return null;

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Your cart</span>
                <h2>Shopping cart</h2>
              </div>
            </Reveal>

            {!user ? (
              <p className="center">
                Please <Link href="/login">sign in</Link> to view your cart.
              </p>
            ) : loading && !cart ? (
              <CartSkeleton />
            ) : !cart || cart.items.length === 0 ? (
              <p className="center">
                Your cart is empty. <Link href="/products">Browse the shop</Link>.
              </p>
            ) : (
              <div className="cart">
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
                <ul className="cart-items">
                  {cart.items.map((item) => (
                    <li className="cart-item" key={item.id}>
                      <div className="cart-item-info">
                        <strong>{item.product_name}</strong>
                        <span className="product-cat">
                          {formatPrice(item.unit_price)} each
                        </span>
                      </div>
                      <div className="cart-item-qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            run(() =>
                              item.quantity > 1
                                ? updateItem(item.id, item.quantity - 1)
                                : removeItem(item.id)
                            )
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => run(() => updateItem(item.id, item.quantity + 1))}
                        >
                          +
                        </button>
                      </div>
                      <span className="cart-item-subtotal">
                        {formatPrice(item.subtotal)}
                      </span>
                      <button
                        className="cart-item-remove"
                        type="button"
                        onClick={() => run(() => removeItem(item.id))}
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="cart-summary">
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{formatPrice(cart.total)}</strong>
                  </div>
                  <div className="cart-actions">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => run(() => clear())}
                    >
                      Clear cart
                    </button>
                    <Link className="btn btn-primary" href="/checkout">
                      Checkout
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
