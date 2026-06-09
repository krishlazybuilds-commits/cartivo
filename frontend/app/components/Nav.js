"use client";

import Link from "next/link";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";

export default function Nav() {
  const { user, logout, loading } = useAuth();
  const { itemCount } = useCart();

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="/" className="brand" aria-label="Cartivo home">
          <span className="brand-dot">C</span>
          Cartivo
        </a>
        <div className="nav-links">
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#why">Why Cartivo</a>
          <Link href="/products">Shop</Link>
        </div>
        <div className="nav-cta">
          {loading ? null : user ? (
            <>
              <Link href="/cart" className="nav-cart" aria-label="Cart">
                Cart
                {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
              </Link>
              <Link href="/orders" className="nav-cart">
                Orders
              </Link>
              <Link href="/profile" className="nav-user">Hi, {user.username}</Link>
              <button className="btn btn-ghost" onClick={logout} type="button">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
