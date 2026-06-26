"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Users" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/warehouses", label: "Warehouses" },
  { href: "/admin/ai-studio", label: "AI Studio" },
];

export default function AdminTabs() {
  const pathname = usePathname() || "";
  const normalizedPath = pathname.replace(/\/$/, "");

  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {TABS.map((t) => {
        const tabPath = t.href.replace(/\/$/, "");
        const isActive = normalizedPath === tabPath;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`admin-tab${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
