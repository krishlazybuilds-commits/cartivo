import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockRouter, mockUseAuth, mockAuthFetch, mockPathname } = vi.hoisted(() => {
  const mockRouter = { replace: vi.fn(), push: vi.fn() };
  let mockPathname = "/admin/warehouses";
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

import AdminWarehousesPage from "../warehouses/page";

const staffUser = { id: 1, username: "admin", is_staff: true, is_superuser: true };
const sampleWarehouses = [
  { id: 1, name: "Main", code: "MAIN", address: "100 Main St", is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: 2, name: "East", code: "EAST", address: "200 East Ave", is_active: false, created_at: "2026-02-01T00:00:00Z" },
];
const sampleStocks = [
  { id: 1, warehouse: 1, product: 10, product_name: "Widget", variant: null, variant_name: null, stock: 50 },
  { id: 2, warehouse: 2, product: 10, product_name: "Widget", variant: 5, variant_name: "Blue", stock: 20 },
];

describe("AdminWarehousesPage — auth guard", () => {
  it("redirects unauthenticated users to login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<AdminWarehousesPage />);
    expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=/admin/warehouses");
  });

  it("redirects non-staff users to home", () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, username: "normal", is_staff: false }, loading: false });
    render(<AdminWarehousesPage />);
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("renders nothing while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AdminWarehousesPage />);
    expect(container.innerHTML).toBe("");
  });
});

describe("AdminWarehousesPage — warehouse CRUD", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockImplementation((url, opts) => {
      if (url === "/warehouses/") return Promise.resolve({ results: sampleWarehouses });
      if (url === "/warehouse-stocks/") return Promise.resolve({ results: sampleStocks });
      return Promise.reject(new Error("unexpected call"));
    });
  });

  it("fetches warehouses on mount", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Main").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders warehouse rows", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getByText("MAIN")).toBeInTheDocument();
      expect(screen.getByText("EAST")).toBeInTheDocument();
    });
  });

  it("shows empty state when no warehouses", async () => {
    mockAuthFetch.mockImplementation((url) => {
      if (url === "/warehouses/") return Promise.resolve({ results: [] });
      if (url === "/warehouse-stocks/") return Promise.resolve({ results: [] });
      return Promise.reject(new Error("unexpected call"));
    });
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getByText("No warehouses yet.")).toBeInTheDocument();
    });
  });

  it("opens form on New warehouse click", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      fireEvent.click(screen.getByText("+ New warehouse"));
    });
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toBeInTheDocument();
  });

  it("calls POST on form submit", async () => {
    mockAuthFetch.mockImplementation((url, opts) => {
      if (url === "/warehouses/") return Promise.resolve({ results: sampleWarehouses });
      if (url === "/warehouse-stocks/") return Promise.resolve({ results: sampleStocks });
      if (opts?.method === "POST") return Promise.resolve({ id: 3, name: "New WH", code: "NEW", address: "", is_active: true });
      return Promise.reject(new Error("unexpected call"));
    });
    render(<AdminWarehousesPage />);
    fireEvent.click(screen.getByText("+ New warehouse"));
    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New WH" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "NEW" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/warehouses/", expect.objectContaining({ method: "POST" }));
    });
  });

  it("calls DELETE on delete button", async () => {
    mockAuthFetch.mockImplementation((url, opts) => {
      if (url === "/warehouses/") return Promise.resolve({ results: sampleWarehouses });
      if (url === "/warehouse-stocks/") return Promise.resolve({ results: sampleStocks });
      if (opts?.method === "DELETE") return Promise.resolve({});
      return Promise.reject(new Error("unexpected call"));
    });
    const confirmFn = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmFn);
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      const deleteBtns = screen.getAllByText("Delete");
      fireEvent.click(deleteBtns[0]);
    });
    expect(confirmFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/warehouses/1/", expect.objectContaining({ method: "DELETE" }));
    });
  });
});

describe("AdminWarehousesPage — stock table", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockImplementation((url) => {
      if (url === "/warehouses/") return Promise.resolve({ results: sampleWarehouses });
      if (url === "/warehouse-stocks/") return Promise.resolve({ results: sampleStocks });
      return Promise.reject(new Error("unexpected call"));
    });
  });

  it("fetches and renders stock rows", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Widget").length).toBe(2);
    });
  });

  it("renders variant name when present", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getByText("Blue")).toBeInTheDocument();
    });
  });

  it("shows — for null variant name", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows stock value", async () => {
    render(<AdminWarehousesPage />);
    await waitFor(() => {
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
    });
  });
});
