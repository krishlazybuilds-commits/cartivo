import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockUseAuth, mockAuthFetch, mockSearchParams } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
  mockAuthFetch: vi.fn(),
  mockSearchParams: { get: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

import OrdersPage from "../page";

function sampleOrder(id, overrides = {}) {
  return {
    id,
    order_number: `ORD-${id}`,
    status: "pending",
    created_at: "2026-06-01T12:00:00Z",
    total: "49.99",
    items: [
      { id: 1, product_name: "Widget", quantity: 2, subtotal: "39.98" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.get.mockReturnValue(null);
});

describe("OrdersPage", () => {
  it("shows sign-in prompt when user is not authenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<OrdersPage />);
    expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows loading skeleton while fetching", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    render(<OrdersPage />);
    expect(await screen.findByText(/order history/i)).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockRejectedValue(new Error("Network error"));
    render(<OrdersPage />);
    expect(await screen.findByText(/couldn't load your orders/i)).toBeInTheDocument();
  });

  it("shows empty state when no orders", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<OrdersPage />);
    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start shopping/i })).toHaveAttribute("href", "/products");
  });

  it("renders orders list", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue({
      results: [sampleOrder(1), sampleOrder(2, { status: "paid" })],
    });
    render(<OrdersPage />);
    expect(await screen.findByText(/ORD-1/i)).toBeInTheDocument();
    expect(screen.getByText(/ORD-2/i)).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });

  it("shows complete payment button for pending orders", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue({
      results: [sampleOrder(1, { status: "pending" })],
    });
    render(<OrdersPage />);
    expect(await screen.findByText(/ORD-1/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /complete payment/i })).toHaveAttribute(
      "href", "/orders/1"
    );
  });

  it("shows placed order success banner", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [sampleOrder(1)] });
    mockSearchParams.get.mockImplementation((key) => {
      if (key === "placed") return "42";
      if (key === "paid") return "1";
      return null;
    });
    render(<OrdersPage />);
    expect(await screen.findByText(/order #42 paid successfully/i)).toBeInTheDocument();
  });

  it("shows placed (unpaid) banner when paid param absent", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [sampleOrder(1)] });
    mockSearchParams.get.mockImplementation((key) => {
      if (key === "placed") return "42";
      return null;
    });
    render(<OrdersPage />);
    expect(await screen.findByText(/order #42 placed successfully/i)).toBeInTheDocument();
  });

  it("does not call authFetch while auth is loading", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<OrdersPage />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });

  it("renders the heading", async () => {
    render(<OrdersPage />);
    expect(await screen.findByText(/order history/i)).toBeInTheDocument();
  });
});
