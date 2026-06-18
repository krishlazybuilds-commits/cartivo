import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "../lib/format";
import StarRating from "./StarRating";

export default function ProductCard({ product, showRating = false, children, className = "" }) {
  return (
    <div className={`feature-card product-card ${className}`.trim()} style={{ position: "relative" }}>
      <Link href={`/products/${product.slug}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
        <div className="product-image">
          {product.image ? (
            <Image src={product.image} alt={product.name} width={400} height={300} className="product-img" />
          ) : (
            <span className="product-image-ph" aria-hidden="true">
              {product.name?.[0] ?? "?"}
            </span>
          )}
          {product.display_badge && (
            <span style={{
              position: "absolute", top: "0.5rem", left: "0.5rem",
              background: product.on_sale ? "#e11d48" : product.is_new ? "#2563eb" : "#111",
              color: "#fff", fontSize: "0.7rem", fontWeight: 600,
              padding: "0.15rem 0.55rem", borderRadius: 4, zIndex: 2,
            }}>
              {product.display_badge}
            </span>
          )}
        </div>
        <span className="product-cat">{product.category_name ?? "Product"}</span>
        <h3>{product.name}</h3>
        {showRating && product.review_count > 0 && <StarRating value={product.avg_rating ?? 0} count={product.review_count} size="0.85rem" />}
        {product.description && <p>{product.description}</p>}
        <div className="product-meta">
          <span className="product-price">
            {formatPrice(product.effective_price ?? product.price)}
            {product.on_sale && product.sale_price && (
              <span style={{ fontSize: "0.78em", opacity: 0.5, textDecoration: "line-through", marginLeft: "0.3rem" }}>
                {formatPrice(product.price)}
              </span>
            )}
          </span>
          <span className={product.in_stock ? "product-stock" : "product-stock out"}>
            {product.in_stock ? "In stock" : "Out of stock"}
          </span>
        </div>
      </Link>
      {children}
    </div>
  );
}
