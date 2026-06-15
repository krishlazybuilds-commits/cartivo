import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockUseAuth, mockAuthFetch, mockParams } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
  mockAuthFetch: vi.fn(),
  mockParams: { id: "42" },
}));

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/Breadcrumbs", () => ({
  default: () => <div data-testid="breadcrumbs" />,
}));

import OrderDetailPage from "../[id]/page";

function sampleOrder(overrides = {}) {
  return {
    id: 42,
    order_number: "ORD-42",
    status: "pending",
    created_at: "2026-06-01T12:00:00Z",
    total: "49.99",
    discount: "0.00",
    shipping_cost: "5.00",
    tax_amount: "4.00",
    coupon_code: null,
    shipping_full_name: "Jane Doe",
    shipping_address: "123 Main St",
    shipping_city: "Portland",
    shipping_postal_code: "97201",
    shipping_country: "US",
    items: [
      { id: 1, product_name: "Widget", quantity: 2, subtotal: "39.98" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete window.location;
  window.location = { href: "" };
});

describe("OrderDetailPage", () => {
  it("shows sign-in prompt when user is not authenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<OrderDetailPage />);
    expect(await screen.findByText(/sign in/i)).toBeInTheDocument();
  });

  it("shows loading skeleton while fetching", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    render(<OrderDetailPage />);
    expect(await screen.findByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockRejectedValue(new Error("Not found"));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it("renders order detail for paid order", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({ status: "paid" }));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getByText(/jane doe/i)).toBeInTheDocument();
    expect(screen.getByText(/123 main st/i)).toBeInTheDocument();
    expect(screen.getByText(/portland/i)).toBeInTheDocument();
    expect(screen.getByText(/US/)).toBeInTheDocument();
  });

  it("renders shipping, tax, and total breakdown", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({ status: "paid" }));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();
    expect(screen.getByText(/^Shipping$/)).toBeInTheDocument();
    expect(screen.getByText(/^Tax$/)).toBeInTheDocument();
  });

  it("shows discount when applicable", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({
      status: "paid", discount: "10.00", coupon_code: "SAVE10",
    }));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();
    expect(screen.getByText(/SAVE10/i)).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
  });

  it("shows pay and cancel buttons for pending orders", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({ status: "pending" }));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeInTheDocument();
  });

  it("does not show pay/cancel buttons for non-pending orders", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({ status: "paid" }));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it("calls pay endpoint and redirects on pay click", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));
    mockAuthFetch.mockResolvedValueOnce({ url: "https://checkout.stripe.com/..." });

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /complete payment/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/orders/42/pay/", { method: "POST" });
    });
    expect(window.location.href).toBe("https://checkout.stripe.com/...");
  });

  it("shows pay error on failure", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));
    mockAuthFetch.mockRejectedValueOnce(new Error("Payment failed"));

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /complete payment/i }));
    expect(await screen.findByText(/payment failed/i)).toBeInTheDocument();
  });

  it("shows Redirecting… while paying", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));
    mockAuthFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /complete payment/i }));
    expect(await screen.findByText(/redirecting…/i)).toBeInTheDocument();
  });

  it("opens confirm dialog before cancelling", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    expect(screen.getByText(/cancel this order/i)).toBeInTheDocument();
  });

  it("cancels order and updates state on confirm", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "cancelled" }));

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /cancel order/i })[1]);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/orders/42/cancel/", { method: "POST" });
    });
    expect(screen.getByText("cancelled")).toBeInTheDocument();
  });

  it("shows cancel error on failure", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValueOnce(sampleOrder({ status: "pending" }));
    mockAuthFetch.mockRejectedValueOnce(new Error("Cannot cancel"));

    render(<OrderDetailPage />);
    expect(await screen.findByText(/ORD-42/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /cancel order/i })[1]);

    expect(await screen.findByText(/cannot cancel/i)).toBeInTheDocument();
  });

  it("renders breadcrumbs", async () => {
    mockUseAuth.mockReturnValue({ user: { username: "jane" }, loading: false });
    mockAuthFetch.mockResolvedValue(sampleOrder({ status: "paid" }));
    render(<OrderDetailPage />);
    expect(await screen.findByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("does not fetch order while auth is loading", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<OrderDetailPage />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockAuthFetch).not.toHaveBeenCalled();
  });
});
