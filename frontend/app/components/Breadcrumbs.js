import Link from "next/link";

/**
 * Accessible breadcrumb trail.
 *
 * Props:
 *  - items: array of { label, href } — the final item is rendered as the
 *    current page (no link) if it has no href.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
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
  );
}
