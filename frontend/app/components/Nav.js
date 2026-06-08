"use client";

import Link from "next/link";

import { useAuth } from "../lib/auth";

export default function Nav() {
  const { user, logout, loading } = useAuth();

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
              <span className="nav-user">Hi, {user.username}</span>
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
