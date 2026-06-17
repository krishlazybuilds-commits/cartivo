import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockAuthFetch, mockToast } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null })),
  mockAuthFetch: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("../auth", () => ({
  useAuth: mockUseAuth,
  authFetch: mockAuthFetch,
}));

vi.mock("../toast", () => ({
  useToast: () => mockToast,
}));

import { WishlistProvider, useWishlist } from "../wishlist";

function WishlistConsumer() {
  const ctx = useWishlist();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="count">{ctx.count}</div>
      <div data-testid="items">{JSON.stringify(ctx.items)}</div>
      <div data-testid="wishlisted-1">{String(ctx.isWishlisted(1))}</div>
      <div data-testid="wishlisted-2">{String(ctx.isWishlisted(2))}</div>
      <button onClick={() => ctx.toggle(1)}>Toggle 1</button>
      <button onClick={() => ctx.toggle(2)}>Toggle 2</button>
      <button onClick={() => ctx.removeById(10)}>Remove item 10</button>
      <button onClick={() => ctx.removeById(99)}>Remove item 99</button>
    </div>
  );
}

function renderWishlist() {
  return render(
    <WishlistProvider>
      <WishlistConsumer />
    </WishlistProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: null });
  mockAuthFetch.mockReset();
  mockToast.mockReset();
});

describe("WishlistProvider — guest mode", () => {
  it("starts with empty list when not authenticated", async () => {
    renderWishlist();
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });
  });

  it("toggle adds item to guest wishlist when not wishlisted", async () => {
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(screen.getByTestId("wishlisted-1").textContent).toBe("true");
    });

    expect(mockToast).toHaveBeenCalledWith("Saved to wishlist", "success");
    const items = JSON.parse(screen.getByTestId("items").textContent);
    expect(items).toHaveLength(1);
    expect(items[0].product).toBe(1);
    expect(items[0].id).toBe("guest-1");
  });

  it("toggle removes item from guest wishlist when wishlisted", async () => {
    const initialItem = {
      id: "guest-1",
      product: 1,
      product_name: "Product #1",
      product_slug: "",
      product_price: "0.00",
      product_image: null,
      added_at: new Date().toISOString(),
    };
    localStorage.setItem("cartivo_guest_wishlist", JSON.stringify([initialItem]));

    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(screen.getByTestId("wishlisted-1").textContent).toBe("true");

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
      expect(screen.getByTestId("wishlisted-1").textContent).toBe("false");
    });

    expect(mockToast).toHaveBeenCalledWith("Removed from wishlist", "info");
    const items = JSON.parse(screen.getByTestId("items").textContent);
    expect(items).toHaveLength(0);
  });
});

describe("WishlistProvider — authenticated mode", () => {
  const serverItems = [
    { id: 10, product: 1, product_name: "Widget", product_price: "19.99", product_slug: "widget" },
    { id: 11, product: 2, product_name: "Gadget", product_price: "29.99", product_slug: "gadget" },
  ];

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "testuser" } });
    mockAuthFetch.mockResolvedValue(serverItems);
  });

  it("loads server wishlist on mount", async () => {
    renderWishlist();
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/");
    });
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2");
    });
    const items = JSON.parse(screen.getByTestId("items").textContent);
    expect(items).toHaveLength(2);
    expect(items[0].product_name).toBe("Widget");
    expect(items[1].product_name).toBe("Gadget");
  });

  it("isWishlisted returns correct values", async () => {
    renderWishlist();
    await waitFor(() => {
      expect(screen.getByTestId("wishlisted-1").textContent).toBe("true");
    });
    expect(screen.getByTestId("wishlisted-2").textContent).toBe("true");
  });

  it("isWishlisted returns false for items not in list", async () => {
    mockAuthFetch.mockResolvedValue([]);
    renderWishlist();
    await waitFor(() => {
      expect(screen.getByTestId("wishlisted-1").textContent).toBe("false");
    });
  });

  it("toggle calls POST /wishlist/ when item is not wishlisted", async () => {
    mockAuthFetch.mockResolvedValueOnce([]); // initial load
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    mockAuthFetch.mockResolvedValue({ id: 20, product: 1, product_name: "NewItem" });

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ product: 1 }),
      }));
    });
  });

  it("removeById calls DELETE /wishlist/{id}/", async () => {
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));

    mockAuthFetch.mockResolvedValue(null);

    fireEvent.click(screen.getByText("Remove item 10"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/10/", expect.objectContaining({
        method: "DELETE",
      }));
    });
  });

  it("removeById calls DELETE for arbitrary id", async () => {
    mockAuthFetch.mockResolvedValue([]);
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    mockAuthFetch.mockResolvedValue(null);

    fireEvent.click(screen.getByText("Remove item 99"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/99/", expect.objectContaining({
        method: "DELETE",
      }));
    });
  });

  it("toggle calls add when item is not wishlisted", async () => {
    mockAuthFetch.mockResolvedValue([]);
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    mockAuthFetch.mockResolvedValue({ id: 30, product: 1, product_name: "Widget" });

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ product: 1 }),
      }));
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Saved to wishlist", "success");
    });
  });

  it("toggle calls remove when item is wishlisted", async () => {
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));

    mockAuthFetch.mockResolvedValue(null);

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/wishlist/10/", expect.objectContaining({
        method: "DELETE",
      }));
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Removed from wishlist", "info");
    });
  });

  it("toggle shows error toast on failure", async () => {
    mockAuthFetch.mockResolvedValue([]);
    renderWishlist();
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    mockAuthFetch.mockRejectedValue(new Error("Server error"));

    fireEvent.click(screen.getByText("Toggle 1"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Server error", "error");
    });
  });
});
