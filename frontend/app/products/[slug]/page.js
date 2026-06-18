import Image from "next/image";
import { notFound } from "next/navigation";

import Breadcrumbs from "../../components/Breadcrumbs";
import Reveal from "../../components/Reveal";
import AddToCart from "../../components/AddToCart";
import WishlistButton from "../../components/WishlistButton";
import StarRating from "../../components/StarRating";
import ProductReviews from "../../components/ProductReviews";
import JsonLd from "../../components/JsonLd";
import GalleryImages from "../../components/GalleryImages";
import RecentlyViewedTracker from "../../components/RecentlyViewedTracker";
import RecentlyViewed from "../../components/RecentlyViewed";
import RelatedProducts from "../../components/RelatedProducts";
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
      price: Number(product.effective_price ?? product.price).toFixed(2),
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

export async function generateMetadata(props) {
  const params = await props.params;
  try {
    const product = await apiFetch(`/products/${params.slug}/`, {
      next: { tags: ["products", `product-${params.slug}`] },
    });
    const title = `${product.name} — Cartivo`;
    const description = product.description?.slice(0, 155) || "Shop premium tech at Cartivo.";
    
    return {
      title,
      description,
      alternates: {
        canonical: `/products/${params.slug}`,
      },
      openGraph: {
        title,
        description,
        type: "website",
        url: `${SITE_URL}/products/${params.slug}`,
        images: product.image ? [
          {
            url: product.image,
            width: 1200,
            height: 630,
            alt: product.name,
          }
        ] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: product.image ? [product.image] : [],
      },
    };
  } catch {
    return { title: "Product — Cartivo" };
  }
}

export default async function ProductDetailPage(props) {
  const params = await props.params;
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
              <div className="product-detail-image" style={{ position: "relative" }}>
                {product.images?.length > 0 ? (
                  <GalleryImages images={product.images} mainImage={product.image} name={product.name} />
                ) : product.image ? (
                  <Image src={product.image} alt={product.name} width={600} height={450} className="product-img" priority />
                ) : (
                  <span className="product-image-ph large" aria-hidden="true">
                    {product.name?.[0] ?? "?"}
                  </span>
                )}
                {(product.display_badge) && (
                  <span style={{
                    position: "absolute", top: "0.75rem", left: "0.75rem",
                    background: product.on_sale ? "#e11d48" : product.is_new ? "#2563eb" : "#111",
                    color: "#fff", fontSize: "0.85rem", fontWeight: 600,
                    padding: "0.2rem 0.7rem", borderRadius: 4, zIndex: 2,
                  }}>
                    {product.display_badge}
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
                <span className="product-price">
                  {formatPrice(product.effective_price ?? product.price)}
                  {product.on_sale && product.sale_price && (
                    <span style={{ fontSize: "0.78em", opacity: 0.5, textDecoration: "line-through", marginLeft: "0.4rem" }}>
                      {formatPrice(product.price)}
                    </span>
                  )}
                </span>
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
                  <AddToCart productId={product.id} productName={product.name} productPrice={product.effective_price ?? product.price} inStock={product.in_stock} variants={product.variants ?? []} />
                  <WishlistButton productId={product.id} product={product} withLabel />
                </div>
              </div>
            </article>
            </Reveal>

            <ProductReviews productId={product.id} />

            <RelatedProducts product={product} />

            <RecentlyViewed />
          </div>
        </section>
      </main>

      <RecentlyViewedTracker product={product} />
    </>
  );
}
