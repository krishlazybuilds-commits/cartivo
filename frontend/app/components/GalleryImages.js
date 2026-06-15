"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Product image gallery with a large selected image and thumbnail strip.
 * Falls back to the base product image as the first slide if present.
 */
export default function GalleryImages({ images = [], mainImage, name }) {
  // Build the full list: extra images first (ordered by `order`), with the
  // base product image appended only if there are no extra images.
  const all = images.length > 0
    ? images
    : mainImage
      ? [{ id: "main", image: mainImage, alt: name }]
      : [];

  const [active, setActive] = useState(0);

  if (all.length === 0) {
    return <span className="product-image-ph large" aria-hidden="true">{name?.[0] ?? "?"}</span>;
  }

  const current = all[active];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "var(--surface, #f5f5f5)", borderRadius: 8, overflow: "hidden" }}>
        <Image
          src={current.image}
          alt={current.alt || name}
          fill
          style={{ objectFit: "contain" }}
          priority={active === 0}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      {all.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {all.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              style={{
                width: 64,
                height: 64,
                padding: 0,
                border: i === active ? "2px solid var(--accent, #000)" : "2px solid transparent",
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--surface, #f5f5f5)",
                flexShrink: 0,
              }}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === active}
            >
              <Image
                src={img.image}
                alt={img.alt || name}
                width={64}
                height={64}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
