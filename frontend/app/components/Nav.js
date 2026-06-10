"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";

export default function Nav() {
  const { user, logout, loading } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on route change (link click)
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

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
              {user.is_staff && (
                <Link href="/admin" className="nav-cart">
                  Admin
                </Link>
              )}
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

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          type="button"
        >
          <span className={`hamburger-icon ${menuOpen ? "open" : ""}`} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`nav-drawer ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <div className="nav-drawer-links">
          <a href="/#features" onClick={closeMenu}>Features</a>
          <a href="/#how" onClick={closeMenu}>How it works</a>
          <a href="/#pricing" onClick={closeMenu}>Pricing</a>
          <a href="/#why" onClick={closeMenu}>Why Cartivo</a>
          <Link href="/products" onClick={closeMenu}>Shop</Link>
        </div>
        <div className="nav-drawer-cta">
          {loading ? null : user ? (
            <>
              <Link href="/cart" className="btn btn-ghost" onClick={closeMenu}>
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </Link>
              <Link href="/orders" className="btn btn-ghost" onClick={closeMenu}>
                Orders
              </Link>
              {user.is_staff && (
                <Link href="/admin" className="btn btn-ghost" onClick={closeMenu}>
                  Admin
                </Link>
              )}
              <Link href="/profile" className="btn btn-ghost" onClick={closeMenu}>
                Profile
              </Link>
              <button className="btn btn-ghost" onClick={() => { logout(); closeMenu(); }} type="button">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost" onClick={closeMenu}>
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary" onClick={closeMenu}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
