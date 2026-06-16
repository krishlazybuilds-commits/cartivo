"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { useToast } from "../lib/toast";

/* Minimal primary links shown on desktop. The fuller set (How it works,
   Why Cartivo, account links) lives in the mobile drawer below. */
const LINKS = [
  { label: "Shop", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "Features", href: "/#features" },
  { label: "Blog", href: "/blog" },
];

export default function Nav() {
  const { user, loading: authLoading, authed, displayName, logout } = useAuth();
  const { itemCount } = useCart();
  const toast = useToast();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef(null);

  // Scroll-spy: highlight the nav link for whichever homepage section the
  // viewport's reference line (35% down from the top) is currently over.
  // While in the hero (above the first tracked section), nothing is active.
  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection("");
      return;
    }
    const ids = ["categories", "features"];

    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) {
          current = id;
          break;
        }
      }
      setActiveSection(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
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
    <>
    <nav className="nav nav--min">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Cartivo home">
          <span className="brand-dot">C</span>
          Cartivo
        </Link>

        {/* Desktop links */}
        <div className="nav-links">
          {LINKS.map((l) => {
            const isActive = l.href.startsWith("/#") ? pathname === "/" && activeSection === l.href.slice(2) : pathname.startsWith(l.href);
            return <Link key={l.label} href={l.href} className={isActive ? "active" : ""}>{l.label}</Link>;
          })}
        </div>

        {/* Right actions */}
        <div className="nav-cta">
          {/* Search — hidden on the landing page */}
          {pathname !== "/" && (searchOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (q) { window.location.href = `/search?q=${encodeURIComponent(q)}`; }
                setSearchOpen(false);
                setSearchQuery("");
              }}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                autoFocus
                style={{ fontSize: "0.9rem", padding: "0.3rem 0.6rem", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", outline: "none", width: 180 }}
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              />
              <button type="button" className="nav-icon" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="Close search">✕</button>
            </form>
          ) : (
            <button type="button" className="nav-icon" aria-label="Search" onClick={() => setSearchOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          ))}

          {user || (authed && authLoading) ? (
            <>
              <Link href="/cart" className={`nav-icon${pathname === "/cart" ? " nav-icon-active" : ""}`} aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}>
                <CartIcon />
                {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
              </Link>
              <Link href="/orders" className={`nav-icon${pathname.startsWith("/orders") ? " nav-icon-active" : ""}`} aria-label="Orders">
                <OrdersIcon />
              </Link>
              <div className="nav-account" ref={accountRef}>
                <button
                  type="button"
                  className={`nav-avatar-btn${accountOpen ? " open" : ""}`}
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                >
                  <span className="nav-avatar">{(user?.username || displayName || "U")[0].toUpperCase()}</span>
                  <svg className="nav-avatar-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div className={`nav-account-menu${accountOpen ? " open" : ""}`} role="menu">
                  <div className="nav-account-name-row">{user?.username || displayName}</div>
                  <div className="nav-account-sep" />
                  <Link href="/profile" role="menuitem" onClick={() => setAccountOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Profile
                  </Link>
                  <Link href="/orders" role="menuitem" onClick={() => setAccountOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Orders
                  </Link>
                  <Link href="/wishlist" role="menuitem" onClick={() => setAccountOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    Wishlist
                  </Link>
                  {user?.is_staff && <Link href="/admin" role="menuitem" onClick={() => setAccountOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/></svg>
                    Admin
                  </Link>}
                  <div className="nav-account-sep" />
                  <button type="button" role="menuitem" className="nav-account-signout" onClick={() => { setAccountOpen(false); setSignOutOpen(true); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
          <a href="/#categories" onClick={closeMenu}>Categories</a>
          <a href="/#features" onClick={closeMenu}>Features</a>
          <a href="/#how" onClick={closeMenu}>How it works</a>
          <a href="/#why" onClick={closeMenu}>Why Cartivo</a>
        </div>
        <div className="nav-drawer-cta">
          {user || (authed && authLoading) ? (
            <>
              <Link href="/cart" className="btn btn-ghost" onClick={closeMenu}>
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </Link>
              <Link href="/orders" className="btn btn-ghost" onClick={closeMenu}>Orders</Link>
              <Link href="/wishlist" className="btn btn-ghost" onClick={closeMenu}>Wishlist</Link>
              {user?.is_staff && (
                <Link href="/admin" className="btn btn-ghost" onClick={closeMenu}>Admin</Link>
              )}
              <Link href="/profile" className="btn btn-ghost" onClick={closeMenu}>Profile</Link>
              <button className="btn btn-ghost" onClick={() => { closeMenu(); setSignOutOpen(true); }} type="button">
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
    <SignOutModal
      open={signOutOpen}
      onClose={() => setSignOutOpen(false)}
      onConfirm={() => { setSignOutOpen(false); logout(); toast("Signed out successfully", "success"); }}
    />
    </>
  );
}

function SignOutModal({ open, onClose, onConfirm }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <>
      {open && <div className="signout-backdrop" onClick={onClose} aria-hidden="true" />}
      <div className={`signout-modal${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Sign out confirmation">
        <div className="signout-modal-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="signout-modal-title">Sign out?</h3>
        <p className="signout-modal-desc">You&apos;ll need to sign in again to access your account.</p>
        <div className="signout-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>Sign out</button>
        </div>
      </div>
    </>,
    document.body
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
