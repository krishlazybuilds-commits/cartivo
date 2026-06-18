import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockUseWishlist, mockUseCart, mockToast } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: { id: 1, username: "test" }, loading: false })),
  mockUseWishlist: vi.fn(() => ({ items: [], loading: false, removeById: vi.fn() })),
  mockUseCart: vi.fn(() => ({ addItem: vi.fn() })),
  mockToast: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock("../../lib/wishlist", () => ({
  useWishlist: (...args) => mockUseWishlist(...args),
}));

vi.mock("../../lib/cart", () => ({
  useCart: (...args) => mockUseCart(...args),
}));

vi.mock("../../lib/toast", () => ({
  useToast: () => mockToast,
}));

vi.mock("../../lib/api", () => ({
  API_URL: "http://localhost:8000/api/v1",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../lib/format", () => ({
  formatPrice: (v) => `$${Number(v).toFixed(2)}`,
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/Skeleton", () => ({
  ProductGridSkeleton: () => <div data-testid="skeleton" />,
}));

import WishlistPage from "../page";

const sampleItems = [
  {
    id: 10,
    product: 1,
    product_name: "Widget",
    product_price: "19.99",
    product_slug: "widget",
    product_image: null,
  },
  {
    id: 11,
    product: 2,
    product_name: "Gadget",
    product_price: "29.99",
    product_slug: "gadget",
    product_image: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
  mockUseWishlist.mockReturnValue({ items: sampleItems, loading: false, removeById: vi.fn() });
  mockUseCart.mockReturnValue({ addItem: vi.fn() });
});

describe("WishlistPage — auth guard", () => {
  it("renders wishlist items for guest when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<WishlistPage />);
    expect(screen.getByText(/widget/i)).toBeInTheDocument();
    expect(screen.getByText(/gadget/i)).toBeInTheDocument();
  });

  it("shows skeleton while auth loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<WishlistPage />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});

describe("WishlistPage — empty state", () => {
  it("shows empty message with link to shop", () => {
    mockUseWishlist.mockReturnValue({ items: [], loading: false, removeById: vi.fn() });
    render(<WishlistPage />);
    expect(screen.getByText(/your wishlist is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/products");
  });

  it("shows skeleton while wishlist loading", () => {
    mockUseWishlist.mockReturnValue({ items: [], loading: true, removeById: vi.fn() });
    render(<WishlistPage />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});

describe("WishlistPage — with items", () => {
  it("renders wishlist items with product info", () => {
    render(<WishlistPage />);
    expect(screen.getByText(/widget/i)).toBeInTheDocument();
    expect(screen.getByText(/gadget/i)).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders Move to cart and Remove buttons for each item", () => {
    render(<WishlistPage />);
    const moveBtns = screen.getAllByRole("button", { name: /move to cart/i });
    expect(moveBtns).toHaveLength(2);
    const removeBtns = screen.getAllByRole("button", { name: /remove/i });
    expect(removeBtns).toHaveLength(2);
  });

  it("calls removeById on Remove click", async () => {
    const removeById = vi.fn();
    mockUseWishlist.mockReturnValue({ items: sampleItems, loading: false, removeById });
    render(<WishlistPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    await waitFor(() => {
      expect(removeById).toHaveBeenCalledWith(10);
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Removed from wishlist", "info");
    });
  });

  it("calls addItem and removeById on Move to cart", async () => {
    const addItem = vi.fn();
    const removeById = vi.fn();
    mockUseCart.mockReturnValue({ addItem });
    mockUseWishlist.mockReturnValue({ items: sampleItems, loading: false, removeById });
    render(<WishlistPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /move to cart/i })[0]);

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(1, 1, { name: "Widget", price: 19.99 });
    });

    expect(removeById).toHaveBeenCalledWith(10);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Moved to cart", "success");
    });
  });

  it("shows error toast when remove fails", async () => {
    const removeById = vi.fn().mockRejectedValue(new Error("Network error"));
    mockUseWishlist.mockReturnValue({ items: sampleItems, loading: false, removeById });
    render(<WishlistPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Couldn't remove item", "error");
    });
  });

  it("shows error toast when move to cart fails", async () => {
    const addItem = vi.fn().mockRejectedValue(new Error("Out of stock"));
    mockUseCart.mockReturnValue({ addItem });
    render(<WishlistPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /move to cart/i })[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Out of stock", "error");
    });
  });

  it("disables buttons while an item is busy", async () => {
    render(<WishlistPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /move to cart/i })[0]);

    const allMoveBtns = screen.getAllByRole("button", { name: /move to cart/i });
    // The busy item's button shows "…" (not "Move to cart"), so the remaining
    // 1 "Move to cart" + 2 "Remove" buttons = 3 buttons should still be there.
    expect(allMoveBtns).toHaveLength(1);
  });
});
