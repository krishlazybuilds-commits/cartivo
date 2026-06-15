import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockApiFetch = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("../../components/ShopFilters", () => ({
  default: ({ categories, activeCategory, activeSearch, activeSort }) => (
    <div data-testid="shop-filters" data-categories={categories.length} data-category={activeCategory} data-search={activeSearch} data-sort={activeSort} />
  ),
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/WishlistButton", () => ({
  default: ({ productId, className }) => <span data-testid="wishlist-btn" data-product-id={productId} className={className} />,
}));

vi.mock("../../components/StarRating", () => ({
  default: ({ value, count, size }) => <span data-testid="star-rating" data-value={value} data-count={count} data-size={size} />,
}));

vi.mock("../../lib/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

vi.mock("../../lib/format", () => ({
  formatPrice: (p) => `$${parseFloat(p).toFixed(2)}`,
}));

import ProductsPage from "../page";

function product(id, overrides = {}) {
  return {
    id,
    slug: `product-${id}`,
    name: `Product ${id}`,
    price: "19.99",
    description: `Description for product ${id}`,
    category_name: "Category",
    in_stock: true,
    avg_rating: 4.5,
    review_count: 10,
    image: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductsPage", () => {
  it("renders heading and shop filters", async () => {
    mockApiFetch.mockResolvedValueOnce({ results: [], count: 0 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("Browse the catalog")).toBeInTheDocument();
    expect(screen.getByTestId("shop-filters")).toBeInTheDocument();
  });

  it("renders error state when API fails", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("Something went wrong loading the shop. Please try again in a moment.")).toBeInTheDocument();
  });

  it("renders empty state when no products", async () => {
    mockApiFetch.mockResolvedValueOnce({ results: [], count: 0 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("No products yet.")).toBeInTheDocument();
  });

  it("renders empty state text with filter message when search is active", async () => {
    mockApiFetch.mockResolvedValueOnce({ results: [], count: 0 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { search: "test" } });
    render(element);
    expect(screen.getByText("No products match your filters.")).toBeInTheDocument();
  });

  it("renders empty state text with filter message when category is active", async () => {
    mockApiFetch.mockResolvedValueOnce({ results: [], count: 0 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { category: "1" } });
    render(element);
    expect(screen.getByText("No products match your filters.")).toBeInTheDocument();
  });

  it("renders product cards with correct data", async () => {
    const products = [product(1), product(2)];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 2 });
    mockApiFetch.mockResolvedValueOnce({ results: [{ id: 1, name: "Cat1" }] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.getByText("Description for product 1")).toBeInTheDocument();
  });

  it("renders product cards with placeholder when no image", async () => {
    const products = [product(1, { image: null })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("renders product image when image is provided", async () => {
    const products = [product(1, { image: "/test.jpg", name: "Test Product" })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    const img = screen.getByAltText("Test Product");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/test.jpg");
  });

  it("renders in-stock indicator", async () => {
    const products = [product(1, { in_stock: true })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("renders out-of-stock indicator", async () => {
    const products = [product(1, { in_stock: false })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("renders formatted price", async () => {
    const products = [product(1, { price: "29.99" })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders star rating when reviews exist", async () => {
    const products = [product(1, { avg_rating: 4, review_count: 5 })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    const ratings = screen.getAllByTestId("star-rating");
    expect(ratings[0]).toHaveAttribute("data-value", "4");
    expect(ratings[0]).toHaveAttribute("data-count", "5");
  });

  it("does not render star rating when no reviews", async () => {
    const products = [product(1, { avg_rating: 0, review_count: 0 })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    expect(screen.queryByTestId("star-rating")).not.toBeInTheDocument();
  });

  it("renders page URL helper for product links", async () => {
    const products = [product(1, { slug: "test-product" })];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    const link = screen.getByText("Product 1").closest("a");
    expect(link).toHaveAttribute("href", "/products/test-product");
  });

  it("renders wishlist button per product", async () => {
    const products = [product(1)];
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 1 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: {} });
    render(element);
    const btns = screen.getAllByTestId("wishlist-btn");
    expect(btns[0]).toHaveAttribute("data-product-id", "1");
  });

  it("passes search params to ShopFilters", async () => {
    mockApiFetch.mockResolvedValueOnce({ results: [], count: 0 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { category: "2", search: "phone", ordering: "-price" } });
    render(element);
    const filters = screen.getByTestId("shop-filters");
    expect(filters).toHaveAttribute("data-category", "2");
    expect(filters).toHaveAttribute("data-search", "phone");
    expect(filters).toHaveAttribute("data-sort", "-price");
  });

  it("shows pagination when multiple pages", async () => {
    const products = Array.from({ length: 20 }, (_, i) => product(i + 1));
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 25 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { page: "1" } });
    render(element);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Next →")).toBeInTheDocument();
    expect(screen.getByText(/prev/i)).toBeInTheDocument();
  });

  it("disables prev button on first page", async () => {
    const products = Array.from({ length: 20 }, (_, i) => product(i + 1));
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 25 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { page: "1" } });
    render(element);
    const prev = screen.getByText("← Prev");
    expect(prev).toHaveAttribute("aria-disabled", "true");
  });

  it("disables next button on last page", async () => {
    const products = Array.from({ length: 20 }, (_, i) => product(i + 1));
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 25 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { page: "2" } });
    render(element);
    const next = screen.getByText("Next →");
    expect(next).toHaveAttribute("aria-disabled", "true");
  });

  it("passes category param in pagination links", async () => {
    const products = Array.from({ length: 20 }, (_, i) => product(i + 1));
    mockApiFetch.mockResolvedValueOnce({ results: products, count: 25 });
    mockApiFetch.mockResolvedValueOnce({ results: [] });
    const element = await ProductsPage({ searchParams: { category: "1", page: "1" } });
    render(element);
    const nextLink = screen.getByText("Next →").closest("a");
    expect(nextLink).toHaveAttribute("href", "/products?category=1&page=2");
  });
});
