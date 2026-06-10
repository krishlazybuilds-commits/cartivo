"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { authFetch } from "../lib/auth";
import { formatPrice } from "../lib/format";

const EMPTY = {
  shipping_full_name: "",
  shipping_address: "",
  shipping_city: "",
  shipping_postal_code: "",
  shipping_country: "",
};

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const order = await authFetch("/orders/", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await refresh(); // cart is now empty
      const { url } = await authFetch(`/orders/${order.id}/pay/`, { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return null;

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Checkout</span>
                <h2>Shipping & payment</h2>
              </div>
            </Reveal>

            {!user ? (
              <p className="center">
                Please <Link href="/login">sign in</Link> to check out.
              </p>
            ) : isEmpty ? (
              <p className="center">
                Your cart is empty. <Link href="/products">Browse the shop</Link>.
              </p>
            ) : (
              <div className="checkout">
                <form className="auth-form checkout-form" onSubmit={handleSubmit}>
                  {error && (
                    <p className="auth-error" role="alert">
                      Something went wrong. Please check your details and try again.
                    </p>
                  )}
                  <label>
                    Full name
                    <input type="text" value={form.shipping_full_name} onChange={update("shipping_full_name")} required />
                  </label>
                  <label>
                    Address
                    <input type="text" value={form.shipping_address} onChange={update("shipping_address")} required />
                  </label>
                  <div className="auth-row">
                    <label>
                      City
                      <input type="text" value={form.shipping_city} onChange={update("shipping_city")} required />
                    </label>
                    <label>
                      Postal code
                      <input type="text" value={form.shipping_postal_code} onChange={update("shipping_postal_code")} required />
                    </label>
                  </div>
                  <label>
                    Country
                    <input type="text" value={form.shipping_country} onChange={update("shipping_country")} required />
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? "Redirecting to payment…" : `Pay · ${formatPrice(cart.total)}`}
                  </button>
                </form>

                <aside className="checkout-summary">
                  <h3>Order summary</h3>
                  <ul>
                    {cart.items.map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.quantity} × {item.product_name}
                        </span>
                        <span>{formatPrice(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{formatPrice(cart.total)}</strong>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
