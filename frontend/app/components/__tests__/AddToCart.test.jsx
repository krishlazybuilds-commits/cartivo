import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const mockAddItem = vi.fn();
const mockToast = vi.fn();

vi.mock("../../lib/cart", () => ({
  useCart: () => ({ addItem: mockAddItem }),
}));

vi.mock("../../lib/toast", () => ({
  useToast: () => mockToast,
}));

import AddToCart from "../AddToCart";

const props = { productId: 1, productName: "Test Product", productPrice: "19.99", inStock: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddToCart — out of stock", () => {
  it("renders disabled 'Out of stock' button when inStock is false", () => {
    render(<AddToCart {...props} inStock={false} />);
    const btn = screen.getByRole("button", { name: /out of stock/i });
    expect(btn).toBeDisabled();
  });

  it("does not render quantity selector when out of stock", () => {
    render(<AddToCart {...props} inStock={false} />);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(screen.queryByText("−")).not.toBeInTheDocument();
  });
});

describe("AddToCart — quantity selector", () => {
  it("renders with default quantity 1", () => {
    render(<AddToCart {...props} />);
    expect(screen.getByLabelText("Quantity: 1")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("decrements quantity on − click", () => {
    render(<AddToCart {...props} />);
    const plus = screen.getByRole("button", { name: /increase/i });
    const minus = screen.getByRole("button", { name: /decrease/i });
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByLabelText("Quantity: 3")).toHaveTextContent("3");
    fireEvent.click(minus);
    expect(screen.getByLabelText("Quantity: 2")).toHaveTextContent("2");
  });

  it("does not decrement below 1", () => {
    render(<AddToCart {...props} />);
    expect(screen.getByRole("button", { name: /decrease/i })).toBeDisabled();
  });

  it("enables minus button when quantity > 1", () => {
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(screen.getByRole("button", { name: /decrease/i })).not.toBeDisabled();
  });
});

describe("AddToCart — add to cart button", () => {
  it("renders 'Add to cart' in idle state", () => {
    render(<AddToCart {...props} />);
    expect(screen.getByText("Add to cart")).toBeInTheDocument();
  });

  it("calls addItem with productId, quantity, and metadata", async () => {
    mockAddItem.mockResolvedValue(undefined);
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(1, 1, { name: "Test Product", price: "19.99", variantId: null });
    });
  });

  it("shows 'Adding…' while awaiting addItem", async () => {
    mockAddItem.mockImplementation(() => new Promise(() => {}));
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(screen.getByText("Adding…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
  });

  it("shows 'Added ✓' and toast on success", async () => {
    mockAddItem.mockResolvedValue(undefined);
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() => {
      expect(screen.getByText("Added ✓")).toBeInTheDocument();
    });
    expect(mockToast).toHaveBeenCalledWith("Added 1 to cart", "success");
  });

  it("returns to 'Add to cart' after 2s timeout", async () => {
    vi.useFakeTimers();
    mockAddItem.mockResolvedValue(undefined);
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    await act(async () => {});
    expect(screen.getByText("Added ✓")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Add to cart")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows error state and toast on failure", async () => {
    mockAddItem.mockRejectedValue(new Error("Server error"));
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Server error", "error");
    });
  });

  it("uses default error message when error has no message", async () => {
    mockAddItem.mockRejectedValue(new Error());
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Couldn't add to cart", "error");
    });
  });
});

describe("AddToCart — quantity + add integration", () => {
  it("passes increased quantity to addItem", async () => {
    mockAddItem.mockResolvedValue(undefined);
    render(<AddToCart {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    fireEvent.click(screen.getByText("Add to cart"));
    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith(1, 4, { name: "Test Product", price: "19.99", variantId: null });
    });
  });
});
