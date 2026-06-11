"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";

/* Minimal primary links shown on desktop. The fuller set (How it works,
   Why Cartivo, account links) lives in the mobile drawer below. */
const LINKS = [
  { label: "Shop", href: "/products" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Nav() {
  const { user, logout, loading } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="nav nav--min">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Cartivo home">
          <span className="brand-dot">C</span>
          Cartivo
        </Link>

        {/* Desktop links */}
        <div className="nav-links">
          {LINKS.map((l) =>
            l.href.startsWith("/#") ? (
              <a key={l.label} href={l.href}>{l.label}</a>
            ) : (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            )
          )}
        </div>

        {/* Right actions */}
        <div className="nav-cta">
          {loading ? (
            <>
              <span className="nav-link-min" style={{ visibility: "hidden" }}>Sign in</span>
              <span className="btn btn-primary btn-sm" style={{ visibility: "hidden" }}>Get started</span>
            </>
          ) : user ? (
            <>
              <Link href="/cart" className="nav-icon" aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}>
                <CartIcon />
                {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
              </Link>
              <Link href="/orders" className="nav-link-min">Orders</Link>
              {user.is_staff && <Link href="/admin" className="nav-link-min">Admin</Link>}
              <Link href="/profile" className="nav-user">{user.username}</Link>
              <button className="btn btn-ghost btn-sm" onClick={logout} type="button">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link-min">Sign in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
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
          <Link href="/products" onClick={closeMenu}>Shop</Link>
          <a href="/#features" onClick={closeMenu}>Features</a>
          <a href="/#how" onClick={closeMenu}>How it works</a>
          <a href="/#pricing" onClick={closeMenu}>Pricing</a>
          <a href="/#why" onClick={closeMenu}>Why Cartivo</a>
        </div>
        <div className="nav-drawer-cta">
          {loading ? null : user ? (
            <>
              <Link href="/cart" className="btn btn-ghost" onClick={closeMenu}>
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </Link>
              <Link href="/orders" className="btn btn-ghost" onClick={closeMenu}>Orders</Link>
              <Link href="/wishlist" className="btn btn-ghost" onClick={closeMenu}>Wishlist</Link>
              {user.is_staff && (
                <Link href="/admin" className="btn btn-ghost" onClick={closeMenu}>Admin</Link>
              )}
              <Link href="/profile" className="btn btn-ghost" onClick={closeMenu}>Profile</Link>
              <button className="btn btn-ghost" onClick={() => { logout(); closeMenu(); }} type="button">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost" onClick={closeMenu}>Sign in</Link>
              <Link href="/register" className="btn btn-primary" onClick={closeMenu}>Get started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 4h12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="17" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}
