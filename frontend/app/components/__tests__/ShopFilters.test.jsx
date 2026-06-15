import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: {
    get: vi.fn(),
    toString: vi.fn(() => ""),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("../SortSelect", () => ({
  default: ({ value, options, onChange }) => (
    <select
      data-testid="sort-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

import ShopFilters from "../ShopFilters";

const categories = [
  { id: 1, name: "Electronics" },
  { id: 2, name: "Clothing" },
  { id: 3, name: "Books" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.get.mockReturnValue(null);
  mockSearchParams.toString.mockReturnValue("");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ShopFilters — rendering", () => {
  it("renders search input", () => {
    render(<ShopFilters categories={categories} />);
    expect(screen.getByPlaceholderText("Search products…")).toBeInTheDocument();
  });

  it("renders All category button as active by default", () => {
    render(<ShopFilters categories={categories} />);
    const allBtn = screen.getByText("All");
    expect(allBtn).toHaveClass("active");
  });

  it("renders all category buttons", () => {
    render(<ShopFilters categories={categories} />);
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Clothing")).toBeInTheDocument();
    expect(screen.getByText("Books")).toBeInTheDocument();
  });

  it("marks active category button", () => {
    render(<ShopFilters categories={categories} activeCategory="2" />);
    expect(screen.getByText("All")).not.toHaveClass("active");
    expect(screen.getByText("Clothing")).toHaveClass("active");
  });

  it("renders SortSelect with sort options", () => {
    render(<ShopFilters categories={categories} />);
    const select = screen.getByTestId("sort-select");
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(7);
  });

  it("sets search input value from activeSearch prop", () => {
    render(<ShopFilters categories={categories} activeSearch="laptop" />);
    expect(screen.getByPlaceholderText("Search products…")).toHaveValue("laptop");
  });

  it("sets SortSelect value from activeSort prop", () => {
    render(<ShopFilters categories={categories} activeSort="-created_at" />);
    expect(screen.getByTestId("sort-select")).toHaveValue("-created_at");
  });
});

describe("ShopFilters — category filter", () => {
  it("navigates to /products when All is clicked", () => {
    render(<ShopFilters categories={categories} />);
    fireEvent.click(screen.getByText("All"));
    expect(mockPush).toHaveBeenCalledWith("/products");
  });

  it("navigates with category param when category button is clicked", () => {
    render(<ShopFilters categories={categories} activeCategory="1" />);
    fireEvent.click(screen.getByText("Clothing"));
    expect(mockPush).toHaveBeenCalledWith("/products?category=2");
  });

  it("passes existing search params through to buildQuery", () => {
    mockSearchParams.toString.mockReturnValue("search=test");
    render(<ShopFilters categories={categories} />);
    fireEvent.click(screen.getByText("Electronics"));
    expect(mockPush).toHaveBeenCalledWith("/products?search=test&category=1");
  });

  it("clears page param when category changes", () => {
    mockSearchParams.toString.mockReturnValue("page=2");
    render(<ShopFilters categories={categories} />);
    fireEvent.click(screen.getByText("Electronics"));
    expect(mockPush).toHaveBeenCalledWith("/products?category=1");
  });

  it("sets category param when same category clicked (component always sets category)", () => {
    render(<ShopFilters categories={categories} activeCategory="1" />);
    fireEvent.click(screen.getByText("Electronics"));
    expect(mockPush).toHaveBeenCalledWith("/products?category=1");
  });
});

describe("ShopFilters — sort", () => {
  it("navigates with ordering param on sort change", () => {
    render(<ShopFilters categories={categories} />);
    fireEvent.change(screen.getByTestId("sort-select"), { target: { value: "-created_at" } });
    expect(mockPush).toHaveBeenCalledWith("/products?ordering=-created_at");
  });

  it("clears ordering param when default sort selected", () => {
    render(<ShopFilters categories={categories} activeSort="-created_at" />);
    fireEvent.change(screen.getByTestId("sort-select"), { target: { value: "" } });
    expect(mockPush).toHaveBeenCalledWith("/products");
  });

  it("clears page param when sort changes", () => {
    mockSearchParams.toString.mockReturnValue("page=3&ordering=price");
    render(<ShopFilters categories={categories} activeSort="price" />);
    fireEvent.change(screen.getByTestId("sort-select"), { target: { value: "-price" } });
    expect(mockPush).toHaveBeenCalledWith("/products?ordering=-price");
  });
});

describe("ShopFilters — search", () => {
  it("shows searching class while debouncing", () => {
    vi.useFakeTimers();
    render(<ShopFilters categories={categories} />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "l" } });
    expect(input.closest(".shop-search")).toHaveClass("is-searching");
    vi.useRealTimers();
  });

  it("navigates after debounce delay", async () => {
    vi.useFakeTimers();
    render(<ShopFilters categories={categories} />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "laptop" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).toHaveBeenCalledWith("/products?search=laptop");
    vi.useRealTimers();
  });

  it("passes existing params through search", () => {
    vi.useFakeTimers();
    mockSearchParams.toString.mockReturnValue("category=1");
    render(<ShopFilters categories={categories} activeCategory="1" />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "phone" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).toHaveBeenCalledWith("/products?category=1&search=phone");
    vi.useRealTimers();
  });

  it("clears page param on search", () => {
    vi.useFakeTimers();
    mockSearchParams.toString.mockReturnValue("page=2");
    render(<ShopFilters categories={categories} />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "test" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).toHaveBeenCalledWith("/products?search=test");
    vi.useRealTimers();
  });

  it("does not navigate when search matches activeSearch", () => {
    vi.useFakeTimers();
    render(<ShopFilters categories={categories} activeSearch="laptop" />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "laptop" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears search param when input is empty", () => {
    vi.useFakeTimers();
    render(<ShopFilters categories={categories} activeSearch="old" />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).toHaveBeenCalledWith("/products");
    vi.useRealTimers();
  });

  it("debounces multiple rapid changes", () => {
    vi.useFakeTimers();
    render(<ShopFilters categories={categories} />);
    const input = screen.getByPlaceholderText("Search products…");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });
    vi.advanceTimersByTime(400);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/products?search=abc");
    vi.useRealTimers();
  });
});
