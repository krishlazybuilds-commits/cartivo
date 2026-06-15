import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockCart, mockFetchShippingEstimate } = vi.hoisted(() => ({
  mockCart: {
    loading: false,
    cart: null,
    itemCount: 0,
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    refresh: vi.fn(),
  },
  mockFetchShippingEstimate: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("../../lib/cart", () => ({
  useCart: () => mockCart,
}));

vi.mock("../../lib/api", () => ({
  fetchShippingEstimate: (...args) => mockFetchShippingEstimate(...args),
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

import CartPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mockCart.loading = false;
  mockCart.cart = null;
  mockCart.itemCount = 0;
  mockCart.updateItem = vi.fn();
  mockCart.removeItem = vi.fn();
  mockCart.clear = vi.fn();
  mockFetchShippingEstimate.mockReset();
});

describe("CartPage", () => {
  it("shows CartSkeleton while loading", () => {
    mockCart.loading = true;
    mockCart.cart = null;
    render(<CartPage />);
    expect(document.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("shows empty state when cart has no items", () => {
    mockCart.cart = { items: [], total: 0, item_count: 0 };
    render(<CartPage />);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/products");
  });

  it("renders cart items with product details", () => {
    mockCart.cart = {
      items: [
        { id: 1, product_name: "Test Widget", unit_price: 19.99, quantity: 2, subtotal: 39.98 },
      ],
      total: 39.98,
      item_count: 2,
    };
    render(<CartPage />);
    expect(screen.getByText("Test Widget")).toBeInTheDocument();
    expect(screen.getByText("$19.99 each")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("$39.98")).toHaveLength(2);
    // One in the item subtotal, one in the cart summary total.
  });

  it("renders subtotal in cart summary", () => {
    mockCart.cart = {
      items: [
        { id: 1, product_name: "A", unit_price: 10, quantity: 1, subtotal: 10 },
        { id: 2, product_name: "B", unit_price: 20, quantity: 2, subtotal: 40 },
      ],
      total: 50,
      item_count: 3,
    };
    render(<CartPage />);
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("calls updateItem with incremented quantity on + button", async () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "Widget", unit_price: 10, quantity: 1, subtotal: 10 }],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText("Increase quantity"));

    await waitFor(() => {
      expect(mockCart.updateItem).toHaveBeenCalledWith(1, 2);
    });
  });

  it("calls updateItem with decremented quantity on − button when qty > 1", async () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "Widget", unit_price: 10, quantity: 3, subtotal: 30 }],
      total: 30,
      item_count: 3,
    };
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText("Decrease quantity"));

    await waitFor(() => {
      expect(mockCart.updateItem).toHaveBeenCalledWith(1, 2);
    });
  });

  it("calls removeItem on − button when quantity is 1", async () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "Widget", unit_price: 10, quantity: 1, subtotal: 10 }],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText("Decrease quantity"));

    await waitFor(() => {
      expect(mockCart.removeItem).toHaveBeenCalledWith(1);
    });
  });

  it("opens ConfirmDialog on Remove button and confirms removal", async () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "Widget", unit_price: 10, quantity: 1, subtotal: 10 }],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);

    fireEvent.click(screen.getByLabelText("Remove item"));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/remove "widget"/i)).toBeInTheDocument();
    });

    // Two "Remove" buttons exist (item + dialog confirm); click the dialog one.
    const buttons = screen.getAllByText("Remove");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(mockCart.removeItem).toHaveBeenCalledWith(1);
    });
  });

  it("opens ConfirmDialog on Clear cart and confirms clear", async () => {
    mockCart.cart = {
      items: [
        { id: 1, product_name: "A", unit_price: 10, quantity: 1, subtotal: 10 },
      ],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);

    fireEvent.click(screen.getByText("Clear cart"));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText(/clear your cart/i)).toBeInTheDocument();
    });

    // Two "Clear cart" buttons exist (ghost + dialog confirm); click the dialog one.
    const buttons = screen.getAllByText("Clear cart");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(mockCart.clear).toHaveBeenCalled();
    });
  });

  it("renders error alert when error exists", () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "A", unit_price: 10, quantity: 1, subtotal: 10 }],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Increase quantity"));
    mockCart.updateItem.mockRejectedValue(new Error("Network error"));

    waitFor(() => {
      // After the rejected promise the error alert should show.
    });
  });

  it("has checkout link pointing to /checkout", () => {
    mockCart.cart = {
      items: [{ id: 1, product_name: "A", unit_price: 10, quantity: 1, subtotal: 10 }],
      total: 10,
      item_count: 1,
    };
    render(<CartPage />);
    const checkoutLink = screen.getByRole("link", { name: /checkout/i });
    expect(checkoutLink).toHaveAttribute("href", "/checkout");
  });
});
