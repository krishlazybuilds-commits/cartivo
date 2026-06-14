import Image from "next/image";
import { notFound } from "next/navigation";

import Breadcrumbs from "../../components/Breadcrumbs";
import Reveal from "../../components/Reveal";
import AddToCart from "../../components/AddToCart";
import WishlistButton from "../../components/WishlistButton";
import StarRating from "../../components/StarRating";
import ProductReviews from "../../components/ProductReviews";
import JsonLd from "../../components/JsonLd";
import { apiFetch } from "../../lib/api";
import { formatPrice } from "../../lib/format";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Build a schema.org/Product object for JSON-LD structured data. Search
 * engines use this to render product rich results (price, availability, etc.).
 */
function buildProductJsonLd(product) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image ? [product.image] : [],
    description: product.description || `Buy ${product.name} at Cartivo.`,
    sku: product.sku || `SKU-${product.id}`,
    brand: {
      "@type": "Brand",
      name: "Cartivo",
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: "USD",
      price: Number(product.price).toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      availability: product.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "Cartivo",
      },
    },
  };

  if (product.review_count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.avg_rating,
      reviewCount: product.review_count,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return data;
}

export async function generateMetadata({ params }) {
  try {
    const product = await apiFetch(`/products/${params.slug}/`, {
      next: { tags: ["products", `product-${params.slug}`] },
    });
    return {
      title: `${product.name} — Cartivo`,
      description: product.description?.slice(0, 150) || "Cartivo product",
      alternates: {
        canonical: `/products/${params.slug}`,
      },
    };
  } catch {
    return { title: "Product — Cartivo" };
  }
}

export default async function ProductDetailPage({ params }) {
  let product;
  try {
    product = await apiFetch(`/products/${params.slug}/`, {
      next: { tags: ["products", `product-${params.slug}`] },
    });
  } catch (e) {
    // A 404 from the API means the product doesn't exist.
    if (String(e.message).includes("404")) notFound();
    throw e;
  }

  return (
    <>
      <JsonLd data={buildProductJsonLd(product)} />
      <main>
        <section className="features">
          <div className="container">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Shop", href: "/products" },
                { label: product.name },
              ]}
            />

            <Reveal>
            <article className="product-detail">
              <div className="product-detail-image">
                {product.image ? (
                  <Image src={product.image} alt={product.name} width={600} height={450} className="product-img" priority />
                ) : (
                  <span className="product-image-ph large" aria-hidden="true">
                    {product.name?.[0] ?? "?"}
                  </span>
                )}
              </div>
              <span className="product-cat">{product.category_name ?? "Product"}</span>
              <h1>{product.name}</h1>
              {product.review_count > 0 && (
                <div className="product-rating">
                  <StarRating value={product.avg_rating ?? 0} count={product.review_count} />
                </div>
              )}
              <div className="product-meta">
                <span className="product-price">{formatPrice(product.price)}</span>
                <span
                  className={product.in_stock ? "product-stock" : "product-stock out"}
                >
                  {product.in_stock ? `In stock (${product.stock})` : "Out of stock"}
                </span>
              </div>
              <p className="product-desc">{product.description}</p>
              <p className="product-sku">SKU: {product.sku}</p>
              <div style={{ marginTop: "1.5rem" }}>
                <div className="product-actions">
                  <AddToCart productId={product.id} productName={product.name} productPrice={product.price} inStock={product.in_stock} />
                  <WishlistButton productId={product.id} withLabel />
                </div>
              </div>
            </article>
            </Reveal>

            <ProductReviews productId={product.id} />
          </div>
        </section>
      </main>
    </>
  );
}
