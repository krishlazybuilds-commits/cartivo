"use client";

import { useState, useEffect, useRef } from "react";
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
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDown(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setAccountOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [accountOpen]);

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
          {user ? (
            <>
              <Link href="/cart" className="nav-icon" aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}>
                <CartIcon />
                {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
              </Link>
              <Link href="/orders" className="nav-icon" aria-label="Orders">
                <OrdersIcon />
              </Link>
              {user.is_staff && (
                <Link href="/admin" className="nav-icon" aria-label="Admin">
                  <AdminIcon />
                </Link>
              )}
              <div className="nav-account" ref={accountRef}>
                <button
                  type="button"
                  className="nav-icon nav-avatar-btn"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                >
                  <span className="nav-avatar">{(user.username || "U")[0].toUpperCase()}</span>
                </button>
                <div className={`nav-account-menu${accountOpen ? " open" : ""}`} role="menu">
                  <div className="nav-account-name-row">{user.username}</div>
                  <div className="nav-account-sep" />
                  <Link href="/profile" role="menuitem" onClick={() => setAccountOpen(false)}>Profile</Link>
                  <Link href="/orders" role="menuitem" onClick={() => setAccountOpen(false)}>Orders</Link>
                  <Link href="/wishlist" role="menuitem" onClick={() => setAccountOpen(false)}>Wishlist</Link>
                  {user.is_staff && <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)}>Admin</Link>}
                  <div className="nav-account-sep" />
                  <button type="button" role="menuitem" className="nav-account-signout" onClick={() => { setAccountOpen(false); logout(); }}>
                    Sign out
                  </button>
                </div>
              </div>
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
          {user ? (
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


function OrdersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
