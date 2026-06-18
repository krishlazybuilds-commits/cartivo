import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockRouter, mockUseAuth, mockAuthFetch, mockPathname } = vi.hoisted(() => {
  const mockRouter = { replace: vi.fn(), push: vi.fn() };
  let mockPathname = "/admin/catalog";
  return {
    mockRouter,
    mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
    mockAuthFetch: vi.fn(),
    mockPathname: { get: () => mockPathname, set: (v) => { mockPathname = v; } },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname.get(),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
  extractError: (data, fallback) => data?.message || fallback || "Something went wrong.",
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/ConfirmDialog", () => ({
  default: ({ open, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <button type="button" onClick={onCancel}>{cancelLabel || "Cancel"}</button>
        <button type="button" data-testid="confirm-action" className={destructive ? "btn-danger" : "btn-primary"} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

import AdminCatalogPage from "../catalog/page";

const staffUser = { id: 1, username: "admin", is_staff: true, is_superuser: true };
const sampleCategories = [
  { id: 1, name: "Electronics", slug: "electronics" },
  { id: 2, name: "Books", slug: "books" },
];
const sampleProducts = [
  { id: 1, name: "Widget", slug: "widget", category: 1, category_name: "Electronics", price: "19.99", stock: 10, sku: "WID-001", is_active: true, description: "A widget", effective_price: "19.99", is_featured: true, is_new: false, on_sale: false, sale_price: null, badge: "", display_badge: null },
  { id: 2, name: "Gadget", slug: "gadget", category: 1, category_name: "Electronics", price: "29.99", stock: 0, sku: "GAD-001", is_active: false, description: "", effective_price: "24.99", is_featured: false, is_new: true, on_sale: true, sale_price: "24.99", badge: "Clearance", display_badge: "Clearance" },
];

/** Helper: configures mount mocks for products (1st call) then categories (2nd call). */
function mockMount(productResult, categoryResult) {
  mockAuthFetch.mockResolvedValueOnce(productResult);
  mockAuthFetch.mockResolvedValueOnce(categoryResult);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.set("/admin/catalog");
});

describe("AdminCatalogPage — auth guard", () => {
  it("redirects to /login?next=/admin/catalog when not authenticated", async () => {
    render(<AdminCatalogPage />);
    await waitFor(() => { expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=/admin/catalog"); });
  });

  it("redirects to / when user is not staff", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, username: "user", is_staff: false }, loading: false });
    render(<AdminCatalogPage />);
    await waitFor(() => { expect(mockRouter.replace).toHaveBeenCalledWith("/"); });
  });

  it("renders nothing while auth loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AdminCatalogPage />);
    expect(container.innerHTML).toBe("");
  });
});

describe("AdminCatalogPage — rendering", () => {
  it("renders heading and description", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/catalog management/i)).toBeInTheDocument();
    expect(screen.getByText(/create, edit, and remove/i)).toBeInTheDocument();
  });

  it("renders AdminTabs", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminCatalogPage />);
    expect(await screen.findByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/admin/catalog");
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute("href", "/admin");
  });

  it("shows loading indicator while fetching products", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockReturnValueOnce(new Promise(() => {})); // products (pending)
    mockAuthFetch.mockResolvedValueOnce([]); // categories
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/loading products/i)).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockRejectedValueOnce({ data: { message: "Failed." } }); // products (reject)
    mockAuthFetch.mockResolvedValueOnce([]); // categories
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
  });
});

describe("AdminCatalogPage — categories", () => {
  it("renders category list", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Books")).toBeInTheDocument();
  });

  it("shows empty state when no categories", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, []);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument();
  });

  it("adds a new category", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, []); // initial load
    mockAuthFetch.mockResolvedValueOnce({}); // POST category
    mockAuthFetch.mockResolvedValueOnce(sampleCategories); // categories reload
    render(<AdminCatalogPage />);
    expect(await screen.findByPlaceholderText(/new category name/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/new category name/i), { target: { value: "Gadgets" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/categories/", {
        method: "POST",
        body: JSON.stringify({ name: "Gadgets" }),
      });
    });
  });

  it("deletes a category via confirm dialog", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/delete category electronics/i));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    mockAuthFetch.mockResolvedValueOnce({}); // DELETE
    mockAuthFetch.mockResolvedValueOnce([]); // categories reload
    fireEvent.click(screen.getByTestId("confirm-action"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/categories/electronics/", { method: "DELETE" });
    });
  });
});

describe("AdminCatalogPage — products", () => {
  it("renders product rows", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: sampleProducts }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Gadget")).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("shows empty state when no products", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/no products yet/i)).toBeInTheDocument();
  });

  it("renders product flag badges in table", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: sampleProducts }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Clearance")).toBeInTheDocument();
  });

  it("renders sale price with strikethrough for on-sale product", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: sampleProducts }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("$24.99")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });
});

describe("AdminCatalogPage — product form", () => {
  it("opens new product form on + New product click", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/\+ new product/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/\+ new product/i));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /new product/i })).toBeInTheDocument();
  });

  it("opens edit product form with pre-filled data", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: sampleProducts }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Edit")[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Widget")).toBeInTheDocument();
    expect(screen.getByDisplayValue("WID-001")).toBeInTheDocument();
  });

  it("pre-fills flag fields when editing a product", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [sampleProducts[1]] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Gadget")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Clearance")).toBeInTheDocument();
    expect(screen.getByDisplayValue("24.99")).toBeInTheDocument();
    expect(screen.getByLabelText("On sale")).toBeChecked();
    expect(screen.getByLabelText("New arrival")).toBeChecked();
    expect(screen.getByLabelText("Featured")).not.toBeChecked();
  });

  it("includes flag fields in create product submit", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/\+ new product/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/\+ new product/i));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Flagged Item" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Price (USD)"), { target: { value: "15.00" } });
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "FLG-001" } });
    fireEvent.click(screen.getByLabelText("Featured"));
    fireEvent.click(screen.getByLabelText("New arrival"));
    fireEvent.click(screen.getByLabelText("On sale"));
    fireEvent.change(screen.getByLabelText("Sale price (USD)"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Custom badge"), { target: { value: "Special" } });
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/products/", {
        method: "POST",
        body: expect.any(FormData),
      });
      const call = mockAuthFetch.mock.calls.find(c => c[0] === "/products/" && c[1]?.method === "POST");
      const fd = call[1].body;
      expect(fd.get("is_featured")).toBe("true");
      expect(fd.get("is_new")).toBe("true");
      expect(fd.get("on_sale")).toBe("true");
      expect(fd.get("sale_price")).toBe("12.00");
      expect(fd.get("badge")).toBe("Special");
    });
  });

  it("creates a new product on submit", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: [] }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/\+ new product/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/\+ new product/i));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Item" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Price (USD)"), { target: { value: "9.99" } });
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "SKU-001" } });
    fireEvent.click(screen.getByRole("button", { name: /create product/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/products/", {
        method: "POST",
        body: expect.any(FormData),
      });
    });
  });

  it("deletes a product via confirm dialog", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: sampleProducts }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText("Widget")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Delete")[0]);
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    mockAuthFetch.mockResolvedValueOnce({}); // DELETE
    mockAuthFetch.mockResolvedValueOnce({ results: [] }); // products reload
    fireEvent.click(screen.getByTestId("confirm-action"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/products/widget/", { method: "DELETE" });
    });
  });
});

describe("AdminCatalogPage — pagination", () => {
  function manyProducts(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: i + 1, name: `Product ${i}`, slug: `product-${i}`, category: 1, category_name: "Electronics", price: "9.99", stock: 1, sku: `SKU-${i}`, is_active: true, description: "",
    }));
  }

  it("shows pagination when count exceeds page size", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockMount({ results: manyProducts(20), count: 25 }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/page.*1.*of.*2/i)).toBeInTheDocument();
    expect(screen.getByText(/next/i)).toBeInTheDocument();
  });

  it("navigates to next page", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    const products = manyProducts(25);
    mockMount({ results: products.slice(0, 20), count: 25 }, sampleCategories);
    render(<AdminCatalogPage />);
    expect(await screen.findByText(/next/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/next/i));
    await waitFor(() => { expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining("page=2")); });
  });
});
