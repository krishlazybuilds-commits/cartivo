"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import NewsletterForm from "./NewsletterForm";

const columns = [
  {
    title: "Explore",
    links: [
      { label: "Categories", href: "/#categories" },
      { label: "Why shop with us", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Our promise", href: "/#why" },
    ],
  },
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "Cart", href: "/cart" },
      { label: "Orders", href: "/orders" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
];

const socials = [
  {
    label: "X (Twitter)",
    href: "https://twitter.com",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z",
  },
  {
    label: "GitHub",
    href: "https://github.com",
    path: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.523 2 12 2z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/krish-tiwari-a85241165/",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z",
  },
];

export default function Footer() {
  const pathname = usePathname();
  return (
    <footer className="footer">
      <span className="footer-watermark" aria-hidden="true">CARTIVO</span>
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="#top" className="brand">
              <span className="brand-dot">C</span>
              Cartivo
            </a>
            <p className="tag">
              Your store for the latest laptops, audio, phones, wearables and more — with secure checkout and fast delivery.
            </p>

            <div className="footer-newsletter">
              <h4>Stay in the loop</h4>
              <p>New arrivals and deals, straight to your inbox. No spam.</p>
              <NewsletterForm />
            </div>

            <div className="footer-social" aria-label="Social links">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="footer-social-link"
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="footer-cols">
            {columns.map((col) => (
              <div key={col.title} className="footer-col">
                <h4>{col.title}</h4>
                <ul>
                  {col.links.map((l) => {
                    const isActive = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href.replace("/#", "/"));
                    return (
                    <li key={l.label}>
                      <Link href={l.href} className={isActive ? "active" : ""}>{l.label}</Link>
                    </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-divider" />

      <div className="footer-bottom">
        <span>© 2026 Cartivo. All rights reserved.</span>
        <a href="#top" className="footer-backtop">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
