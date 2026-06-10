"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";
import { useAuth, authFetch } from "../lib/auth";
import { OrdersListSkeleton } from "../components/Skeleton";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function OrdersContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const placedId = params.get("placed");
  const wasPaid = params.get("paid") === "1";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await authFetch("/orders/");
        if (active) setOrders(data.results ?? data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head center">
                <span className="eyebrow">Your orders</span>
                <h2>Order history</h2>
              </div>
            </Reveal>

            {placedId && (
              <p className="order-placed" role="status">
                ✓ Order #{placedId} {wasPaid ? "paid successfully" : "placed successfully"}. Thank you!
              </p>
            )}

            {!user && !authLoading ? (
              <p className="center">
                Please <Link href="/login">sign in</Link> to view your orders.
              </p>
            ) : loading ? (
              <OrdersListSkeleton />
            ) : error ? (
              <p className="center auth-error">Couldn&apos;t load your orders. Please try again.</p>
            ) : orders.length === 0 ? (
              <p className="center">
                No orders yet. <Link href="/products">Start shopping</Link>.
              </p>
            ) : (
              <div className="orders">
                {orders.map((order, i) => (
                  <Reveal key={order.id} delay={i * 60}>
                    <article className="order-card">
                    <header className="order-head">
                      <div>
                        <Link href={`/orders/${order.id}`}><strong>Order #{order.id}</strong></Link>
                        <span className="product-cat"> {formatDate(order.created_at)}</span>
                      </div>
                      <span className={`order-status status-${order.status}`}>
                        {order.status}
                      </span>
                    </header>
                    <ul className="order-items">
                      {order.items.map((item) => (
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
                      <strong>{formatPrice(order.total)}</strong>
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

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersContent />
    </Suspense>
  );
}
