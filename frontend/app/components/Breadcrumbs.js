import Link from "next/link";
import JsonLd from "./JsonLd";

/**
 * Accessible breadcrumb trail with JSON-LD structured data for SEO.
 *
 * Props:
 *  - items: array of { label, href } — the final item is rendered as the
 *    current page (no link) if it has no href.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Build schema.org/BreadcrumbList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href ? `${SITE_URL}${item.href}` : undefined,
    })).filter(el => el.item), // Only include items with links in the schema
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
    </>
  );
}
