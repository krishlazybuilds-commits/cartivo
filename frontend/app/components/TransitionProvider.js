"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";

/**
 * Page transition that exactly replicates the landing intro feel:
 *
 * 1. Overlay SNAPS on instantly (strips cover immediately — no slide-in)
 * 2. Page title animates in: tagline → letters clip-rise → underline
 * 3. router.push() fires behind the overlay
 * 4. After new page mounts: strips slide UP (identical to landing intro exit)
 * 5. New page fades in underneath
 */

// How long to show the title before navigating
const TITLE_HOLD_MS     = 900;
// How long after pathname change to wait before uncovering
const UNCOVER_DELAY_MS  = 120;
// Total strip-out duration (0.8s longest strip + 0.24s delay = 1.04s + buffer)
const UNCOVER_DONE_MS   = 1100;

const ROUTE_TITLES = {
  "/":                "Home",
  "/products":        "Shop",
  "/categories":      "Categories",
  "/cart":            "Cart",
  "/checkout":        "Checkout",
  "/orders":          "Orders",
  "/wishlist":        "Wishlist",
  "/profile":         "Profile",
  "/login":           "Sign in",
  "/register":        "Get started",
  "/forgot-password": "Reset password",
  "/reset-password":  "Reset password",
  "/contact":         "Contact",
  "/about":           "About",
  "/blog":            "Blog",
  "/roadmap":         "Roadmap",
  "/themes":          "Themes",
  "/privacy":         "Privacy",
  "/terms":           "Terms",
  "/security":        "Security",
  "/admin":           "Admin",
  "/admin/catalog":   "Catalog",
};

function getTitle(href) {
  const path = href.split("?")[0].split("#")[0];
  if (ROUTE_TITLES[path]) return ROUTE_TITLES[path];
  if (path.startsWith("/products/"))   return "Product";
  if (path.startsWith("/categories/")) return "Category";
  if (path.startsWith("/orders/"))     return "Order";
  return "Cartivo";
}

function Overlay({ phase, title }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || phase === "idle") return null;

  const uncovering = phase === "uncovering";

  return createPortal(
    <div className="pt-overlay">
      {/* Strips — always start in covered position, only animate on exit */}
      <div className={`pt-strip pt-strip-1${uncovering ? " pt-strip--exit" : ""}`} />
      <div className={`pt-strip pt-strip-2${uncovering ? " pt-strip--exit" : ""}`} />
      <div className={`pt-strip pt-strip-3${uncovering ? " pt-strip--exit" : ""}`} />

      {/* Center — visible once covered, fades out just before strips leave */}
      <div className={`pt-center${uncovering ? " pt-center--out" : ""}`}>
        <p className="pt-tagline">Cartivo</p>
        <div className="pt-word" aria-label={title}>
          {title.split("").map((ch, i) => (
            <span key={i} className="pt-letter-wrap">
              <span className="pt-letter" style={{ animationDelay: `${0.05 + i * 0.055}s` }}>
                {ch === " " ? "\u00A0" : ch}
              </span>
            </span>
          ))}
        </div>
        <span className="pt-underline" />
      </div>
    </div>,
    document.body
  );
}

export default function TransitionProvider({ children }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState("idle");
  const [title, setTitle] = useState("");

  const busy        = useRef(false);
  const firstRender = useRef(true);

  const navigate = useCallback((href) => {
    if (busy.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    busy.current = true;
    setTitle(getTitle(href));
    // Snap overlay on — covered immediately
    setPhase("covered");

    // Wait for title to animate in, then navigate
    setTimeout(() => {
      router.push(href);
    }, TITLE_HOLD_MS);
  }, [router]);

  // pathname changed → new page is mounted → start uncovering
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (phase !== "covered") return;

    const uncover = setTimeout(() => {
      setPhase("uncovering");
      const done = setTimeout(() => {
        setPhase("idle");
        busy.current = false;
      }, UNCOVER_DONE_MS);
      return () => clearTimeout(done);
    }, UNCOVER_DELAY_MS);

    return () => clearTimeout(uncover);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (
        !href.startsWith("/") ||
        href.startsWith("/#") ||
        a.target === "_blank" ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
        a.hasAttribute("download") ||
        a.getAttribute("data-no-transition") !== null
      ) return;
      const target = href.split("?")[0].split("#")[0];
      if (target === window.location.pathname) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [navigate]);

  return (
    <>
      {children}
      <Overlay phase={phase} title={title} />
    </>
  );
}
