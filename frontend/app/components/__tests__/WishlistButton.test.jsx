import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockIsWishlisted, mockToggle } = vi.hoisted(() => ({
  mockIsWishlisted: vi.fn(),
  mockToggle: vi.fn(),
}));

vi.mock("../../lib/wishlist", () => ({
  useWishlist: () => ({
    isWishlisted: mockIsWishlisted,
    toggle: mockToggle,
  }),
}));

import WishlistButton from "../WishlistButton";

const productId = 42;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WishlistButton — icon-only variant", () => {
  it("renders heart icon and correct aria-label when not wishlisted", () => {
    mockIsWishlisted.mockReturnValue(false);
    render(<WishlistButton productId={productId} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Add to wishlist");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAttribute("title", "Save to wishlist");
    expect(btn).not.toHaveClass("active");
    const svg = btn.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("renders filled heart and correct aria-label when wishlisted", () => {
    mockIsWishlisted.mockReturnValue(true);
    render(<WishlistButton productId={productId} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", "Remove from wishlist");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAttribute("title", "Remove from wishlist");
    expect(btn).toHaveClass("active");
    const svg = btn.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("fill", "#f43f5e");
  });

  it("calls toggle with productId on click", () => {
    mockIsWishlisted.mockReturnValue(false);
    render(<WishlistButton productId={productId} />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockToggle).toHaveBeenCalledWith(productId);
  });

  it("calls preventDefault and stopPropagation on click", () => {
    mockIsWishlisted.mockReturnValue(false);
    render(<WishlistButton productId={productId} />);
    const btn = screen.getByRole("button");
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(clickEvent, "preventDefault");
    const stopPropagation = vi.spyOn(clickEvent, "stopPropagation");
    btn.dispatchEvent(clickEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    mockIsWishlisted.mockReturnValue(false);
    render(<WishlistButton productId={productId} className="my-custom-class" />);
    const btn = screen.getByRole("button");
    expect(btn.classList.contains("my-custom-class")).toBe(true);
  });
});

describe("WishlistButton — with-label variant", () => {
  it("shows 'Save' text when not wishlisted", () => {
    mockIsWishlisted.mockReturnValue(false);
    render(<WishlistButton productId={productId} withLabel />);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows 'Saved' text when wishlisted", () => {
    mockIsWishlisted.mockReturnValue(true);
    render(<WishlistButton productId={productId} withLabel />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("with-label");
  });

  it("toggles wishlist state", () => {
    mockIsWishlisted.mockReturnValue(false);
    const { rerender } = render(<WishlistButton productId={productId} withLabel />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveClass("active");
    mockIsWishlisted.mockReturnValue(true);
    rerender(<WishlistButton productId={productId} withLabel />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveClass("active");
  });
});
