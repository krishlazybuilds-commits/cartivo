import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockApiFetch = vi.fn();
const mockNotFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("../../../components/Breadcrumbs", () => ({
  default: ({ items }) => (
    <nav data-testid="breadcrumbs" data-items={JSON.stringify(items.map(i => i.label))} />
  ),
}));

vi.mock("../../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../../components/AddToCart", () => ({
  default: ({ productId, productName, productPrice, inStock }) => (
    <div data-testid="add-to-cart" data-product-id={productId} data-name={productName} data-price={productPrice} data-in-stock={inStock} />
  ),
}));

vi.mock("../../../components/WishlistButton", () => ({
  default: ({ productId, withLabel }) => (
    <span data-testid="wishlist-btn" data-product-id={productId} data-with-label={withLabel} />
  ),
}));

vi.mock("../../../components/StarRating", () => ({
  default: ({ value, count }) => (
    <span data-testid="star-rating" data-value={value} data-count={count} />
  ),
}));

vi.mock("../../../components/ProductReviews", () => ({
  default: ({ productId }) => (
    <div data-testid="product-reviews" data-product-id={productId} />
  ),
}));

vi.mock("../../../components/JsonLd", () => ({
  default: ({ data }) => (
    <script data-testid="jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  ),
}));

vi.mock("../../../lib/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

vi.mock("../../../lib/format", () => ({
  formatPrice: (p) => `$${parseFloat(p).toFixed(2)}`,
}));

import ProductDetailPage from "../page";

const sampleProduct = {
  id: 1,
  slug: "test-product",
  name: "Test Product",
  price: "29.99",
  description: "A great product.",
  category_name: "Electronics",
  in_stock: true,
  stock: 15,
  sku: "SKU-001",
  image: "/images/test.jpg",
  avg_rating: 4.5,
  review_count: 10,
  effective_price: "29.99",
  is_featured: false,
  is_new: false,
  on_sale: false,
  sale_price: null,
  badge: "",
  display_badge: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductDetailPage", () => {
  it("renders product name and category", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("renders price and stock info", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("In stock (15)")).toBeInTheDocument();
  });

  it("renders sale price with strikethrough when on sale", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, on_sale: true, sale_price: "24.99", effective_price: "24.99", display_badge: "Sale" });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("$24.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders display badge on product detail", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, is_new: true, display_badge: "New" });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("passes effective_price to AddToCart when on sale", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, on_sale: true, sale_price: "24.99", effective_price: "24.99" });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const atc = screen.getByTestId("add-to-cart");
    expect(atc).toHaveAttribute("data-price", "24.99");
  });

  it("renders out of stock when not in stock", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, in_stock: false, stock: 0 });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("renders description", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("A great product.")).toBeInTheDocument();
  });

  it("renders SKU", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("SKU: SKU-001")).toBeInTheDocument();
  });

  it("renders product image when image is provided", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const img = screen.getByAltText("Test Product");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/test.jpg");
  });

  it("renders placeholder when no image", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, image: null });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders star rating when reviews exist", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const rating = screen.getByTestId("star-rating");
    expect(rating).toHaveAttribute("data-value", "4.5");
    expect(rating).toHaveAttribute("data-count", "10");
  });

  it("does not render star rating when no reviews", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, avg_rating: 0, review_count: 0 });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    expect(screen.queryByTestId("star-rating")).not.toBeInTheDocument();
  });

  it("renders AddToCart with correct props", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const atc = screen.getByTestId("add-to-cart");
    expect(atc).toHaveAttribute("data-product-id", "1");
    expect(atc).toHaveAttribute("data-name", "Test Product");
    expect(atc).toHaveAttribute("data-price", "29.99");
    expect(atc).toHaveAttribute("data-in-stock", "true");
  });

  it("renders WishlistButton with withLabel", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const wl = screen.getByTestId("wishlist-btn");
    expect(wl).toHaveAttribute("data-product-id", "1");
    expect(wl).toHaveAttribute("data-with-label", "true");
  });

  it("renders ProductReviews with productId", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const reviews = screen.getByTestId("product-reviews");
    expect(reviews).toHaveAttribute("data-product-id", "1");
  });

  it("renders breadcrumbs with correct items", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const bc = screen.getByTestId("breadcrumbs");
    expect(JSON.parse(bc.getAttribute("data-items"))).toEqual(["Home", "Shop", "Test Product"]);
  });

  it("renders JSON-LD structured data", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const scripts = screen.getAllByTestId("jsonld");
    const productLd = scripts.find(s => JSON.parse(s.textContent)["@type"] === "Product");
    expect(productLd).toBeInTheDocument();
    const data = JSON.parse(productLd.textContent);
    expect(data.name).toBe("Test Product");
    expect(data.offers.price).toBe("29.99");
    expect(data.offers.availability).toBe("https://schema.org/InStock");
  });

  it("uses effective_price in JSON-LD when on sale", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, on_sale: true, sale_price: "19.99", effective_price: "19.99" });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const scripts = screen.getAllByTestId("jsonld");
    const productLd = scripts.find(s => JSON.parse(s.textContent)["@type"] === "Product");
    const data = JSON.parse(productLd.textContent);
    expect(data.offers.price).toBe("19.99");
  });

  it("includes aggregateRating in JSON-LD when reviews exist", async () => {
    mockApiFetch.mockResolvedValue(sampleProduct);
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const scripts = screen.getAllByTestId("jsonld");
    const productLd = scripts.find(s => JSON.parse(s.textContent)["@type"] === "Product");
    const data = JSON.parse(productLd.textContent);
    expect(data.aggregateRating.ratingValue).toBe(4.5);
    expect(data.aggregateRating.reviewCount).toBe(10);
  });

  it("omits aggregateRating in JSON-LD when no reviews", async () => {
    mockApiFetch.mockResolvedValue({ ...sampleProduct, avg_rating: 0, review_count: 0 });
    const element = await ProductDetailPage({ params: { slug: "test-product" } });
    render(element);
    const scripts = screen.getAllByTestId("jsonld");
    const productLd = scripts.find(s => JSON.parse(s.textContent)["@type"] === "Product");
    expect(productLd.textContent).not.toContain("aggregateRating");
  });

  it("calls notFound when API returns 404", async () => {
    mockApiFetch.mockRejectedValue(new Error("404 Not Found"));
    await expect(ProductDetailPage({ params: { slug: "nonexistent" } })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("re-throws non-404 errors", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    await expect(ProductDetailPage({ params: { slug: "test" } })).rejects.toThrow("Network error");
  });
});
