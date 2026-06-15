import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  CartSkeleton,
  OrdersListSkeleton,
  OrderDetailSkeleton,
  ProductGridSkeleton,
} from "../Skeleton";

describe("Skeleton base component", () => {
  it("renders with default props", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector(".skeleton");
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: "100%", height: "1rem", borderRadius: "6px" });
  });

  it("renders with custom width, height, and radius", () => {
    const { container } = render(<Skeleton width="200px" height="2rem" radius="8px" />);
    const el = container.querySelector(".skeleton");
    expect(el).toHaveStyle({ width: "200px", height: "2rem", borderRadius: "8px" });
  });

  it("is hidden from accessibility tree", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("merges custom styles", () => {
    const { container } = render(<Skeleton style={{ marginBottom: "10px" }} />);
    expect(container.querySelector(".skeleton")).toHaveStyle("margin-bottom: 10px");
  });
});

describe("CartSkeleton", () => {
  it("renders 3 cart item skeletons", () => {
    const { container } = render(<CartSkeleton />);
    expect(container.querySelectorAll(".cart-item")).toHaveLength(3);
  });

  it("renders the cart summary section", () => {
    const { container } = render(<CartSkeleton />);
    expect(container.querySelector(".cart-summary")).toBeInTheDocument();
  });
});

describe("OrdersListSkeleton", () => {
  it("renders 2 order card skeletons", () => {
    const { container } = render(<OrdersListSkeleton />);
    expect(container.querySelectorAll(".order-card")).toHaveLength(2);
  });

  it("renders 2 order items per card", () => {
    const { container } = render(<OrdersListSkeleton />);
    container.querySelectorAll(".order-card").forEach((card) => {
      expect(card.querySelectorAll("li")).toHaveLength(2);
    });
  });
});

describe("OrderDetailSkeleton", () => {
  it("renders a single order card", () => {
    const { container } = render(<OrderDetailSkeleton />);
    expect(container.querySelectorAll(".order-card")).toHaveLength(1);
  });

  it("renders 3 order items", () => {
    const { container } = render(<OrderDetailSkeleton />);
    expect(container.querySelectorAll(".order-items li")).toHaveLength(3);
  });
});

describe("ProductGridSkeleton", () => {
  it("renders 6 product cards by default", () => {
    const { container } = render(<ProductGridSkeleton />);
    expect(container.querySelectorAll(".product-card")).toHaveLength(6);
  });

  it("renders custom count of product cards", () => {
    const { container } = render(<ProductGridSkeleton count={4} />);
    expect(container.querySelectorAll(".product-card")).toHaveLength(4);
  });
});
