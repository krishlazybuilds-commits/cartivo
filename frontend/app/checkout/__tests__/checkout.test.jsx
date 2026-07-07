import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockAuthFetch, mockUseCart, mockFetchShippingEstimate, mockRouter } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
  mockAuthFetch: vi.fn(),
  mockUseCart: vi.fn(() => ({ cart: null, refresh: vi.fn() })),
  mockFetchShippingEstimate: vi.fn(),
  mockRouter: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
}));

vi.mock("../../lib/cart", () => ({
  useCart: (...args) => mockUseCart(...args),
}));

vi.mock("../../lib/api", () => ({
  API_URL: "http://localhost:8000/api/v1",
  fetchShippingEstimate: (...args) => mockFetchShippingEstimate(...args),
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

import CheckoutPage from "../page";

const sampleCart = {
  items: [
    { id: 1, product_name: "Widget", unit_price: 19.99, quantity: 2, subtotal: 39.98 },
    { id: 2, product_name: "Gadget", unit_price: 29.99, quantity: 1, subtotal: 29.99 },
  ],
  total: 69.97,
  item_count: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  mockUseCart.mockReturnValue({ cart: null, refresh: vi.fn() });
  mockAuthFetch.mockResolvedValue([]); // default: empty addresses
  mockFetchShippingEstimate.mockReset();
});

describe("CheckoutPage — auth guard", () => {
  it("shows email field for guest users", async () => {
    render(<CheckoutPage />);
    // Guests see an email field instead of being redirected
    expect(mockRouter.replace).not.toHaveBeenCalledWith("/login?next=/checkout");
  });

  it("renders nothing while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<CheckoutPage />);
    expect(container.firstChild).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("renders nothing while auth loading even with guest user", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<CheckoutPage />);
    expect(container.firstChild).toBeNull();
  });

  it("does not redirect when user is authenticated", () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
    mockUseCart.mockReturnValue({ cart: { items: [], total: 0 }, refresh: vi.fn() });
    render(<CheckoutPage />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe("CheckoutPage — empty cart", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
    mockUseCart.mockReturnValue({ cart: { items: [], total: 0 }, refresh: vi.fn() });
  });

  it("shows empty cart message with browse link", () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the shop/i })).toHaveAttribute("href", "/products");
  });
});

describe("CheckoutPage — shipping form", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
    mockUseCart.mockReturnValue({ cart: sampleCart, refresh: vi.fn() });
  });

  it("renders shipping address fields", () => {
    render(<CheckoutPage />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
  });

  it("renders order summary with cart items", () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/2 × widget/i)).toBeInTheDocument();
    expect(screen.getByText(/1 × gadget/i)).toBeInTheDocument();
    // $69.97 appears in both the subtotal and the total line.
    expect(screen.getAllByText("$69.97").length).toBeGreaterThanOrEqual(1);
  });

  it("has a pay button with the total amount", () => {
    render(<CheckoutPage />);
    expect(screen.getByRole("button", { name: /pay/i })).toHaveTextContent("Pay");
  });

  it("renders country select with options", () => {
    render(<CheckoutPage />);
    const select = screen.getByLabelText(/country/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("US");
  });
});

describe("CheckoutPage — coupon", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
    mockUseCart.mockReturnValue({ cart: sampleCart, refresh: vi.fn() });
  });

  it("shows coupon input and apply button", () => {
    render(<CheckoutPage />);
    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument();
  });

  it("calls coupon validation on apply", async () => {
    mockAuthFetch.mockResolvedValue({
      valid: true,
      code: "SAVE10",
      discount_amount: 6.99,
      message: "Coupon applied!",
    });

    render(<CheckoutPage />);
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "SAVE10" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        "/coupons/validate/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "SAVE10", subtotal: 69.97 }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/coupon applied/i)).toBeInTheDocument();
    });
  });

  it("shows error for invalid coupon", async () => {
    mockAuthFetch.mockResolvedValue({
      valid: false,
      message: "Invalid coupon code.",
    });

    render(<CheckoutPage />);
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "BADCODE" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid coupon code/i)).toBeInTheDocument();
    });
  });
});

describe("CheckoutPage — order submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "test" }, loading: false });
    const refresh = vi.fn();
    mockUseCart.mockReturnValue({ cart: sampleCart, refresh });
    // First call: addresses fetch, then order create, then pay
    mockAuthFetch.mockResolvedValueOnce([]);
    mockAuthFetch.mockResolvedValueOnce({ id: 42 });
    mockAuthFetch.mockResolvedValueOnce({ url: "https://checkout.stripe.com/test" });
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  it("creates order and redirects to Stripe", async () => {
    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/^address$/i), { target: { value: "123 Main St" } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Portland" } });
    fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: "97201" } });

    fireEvent.click(screen.getByRole("button", { name: /pay/i }));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/orders/", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          shipping_full_name: "Jane Doe",
          shipping_address: "123 Main St",
          shipping_city: "Portland",
          shipping_postal_code: "97201",
          shipping_country: "US",
          notes: "",
          coupon_code: "",
        }),
      }));
    });

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/orders/42/pay/", expect.objectContaining({
        method: "POST",
      }));
    });

    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/test");
    });
  });

  it("shows error when order creation fails", async () => {
    mockAuthFetch.mockReset();
    mockAuthFetch.mockResolvedValueOnce([]); // addresses
    mockAuthFetch.mockRejectedValueOnce(new Error("Payment method required."));

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/^address$/i), { target: { value: "123 Main St" } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Portland" } });
    fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: "97201" } });

    fireEvent.click(screen.getByRole("button", { name: /pay/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/payment method required/i);
    });
  });

  it("shows error when payment initiation fails", async () => {
    mockAuthFetch.mockReset();
    mockAuthFetch.mockResolvedValueOnce([]); // addresses
    mockAuthFetch.mockResolvedValueOnce({ id: 42 });
    mockAuthFetch.mockRejectedValueOnce(new Error("Stripe error"));

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/^address$/i), { target: { value: "123 Main St" } });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Portland" } });
    fireEvent.change(screen.getByLabelText(/postal code/i), { target: { value: "97201" } });

    fireEvent.click(screen.getByRole("button", { name: /pay/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/stripe error/i);
    });
  });
});
