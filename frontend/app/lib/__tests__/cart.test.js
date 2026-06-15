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

import { CartProvider, useCart } from "../cart";

function CartConsumer() {
  const ctx = useCart();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="item-count">{ctx.itemCount}</div>
      <div data-testid="cart-total">{ctx.cart?.total ?? "null"}</div>
      <div data-testid="cart-items">{JSON.stringify(ctx.cart?.items ?? [])}</div>
      <button onClick={() => ctx.addItem(1, 1, { name: "Widget", price: 19.99 })}>
        Add Widget
      </button>
      <button onClick={() => ctx.addItem(2, 2, { name: "Gadget", price: 29.99 })}>
        Add Gadget
      </button>
      <button onClick={() => ctx.updateItem("guest-1", 5)}>
        Update guest-1
      </button>
      <button onClick={() => ctx.removeItem("guest-1")}>
        Remove guest-1
      </button>
      <button onClick={() => ctx.clear()}>
        Clear
      </button>
    </div>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <CartConsumer />
    </CartProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: null });
  mockAuthFetch.mockReset();
  mockToast.mockReset();
});

describe("CartProvider — guest mode", () => {
  it("starts with empty cart", async () => {
    renderCart();
    await waitFor(() => {
      expect(screen.getByTestId("item-count").textContent).toBe("0");
    });
    expect(screen.getByTestId("cart-total").textContent).toBe("0");
  });

  it("adds a new item to guest cart", async () => {
    renderCart();
    await waitFor(() => {
      expect(screen.getByTestId("item-count").textContent).toBe("0");
    });

    fireEvent.click(screen.getByText("Add Widget"));

    await waitFor(() => {
      expect(screen.getByTestId("item-count").textContent).toBe("1");
    });
    const items = JSON.parse(screen.getByTestId("cart-items").textContent);
    expect(items).toHaveLength(1);
    expect(items[0].product_name).toBe("Widget");
    expect(items[0].unit_price).toBe(19.99);
    expect(items[0].quantity).toBe(1);
    expect(items[0].subtotal).toBe(19.99);
  });

  it("prefixes guest item id with guest-", async () => {
    renderCart();
    await waitFor(() => {
      expect(screen.getByTestId("item-count").textContent).toBe("0");
    });

    fireEvent.click(screen.getByText("Add Widget"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items[0].id).toBe("guest-1");
    });
  });

  it("increments quantity when adding same item again", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    fireEvent.click(screen.getByText("Add Widget"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
      expect(items[0].subtotal).toBe(39.98);
    });
    expect(screen.getByTestId("item-count").textContent).toBe("2");
    expect(screen.getByTestId("cart-total").textContent).toBe("39.98");
  });

  it("stores multiple distinct items", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    fireEvent.click(screen.getByText("Add Gadget"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items).toHaveLength(2);
    });
    expect(screen.getByTestId("item-count").textContent).toBe("3"); // 1 + 2
    expect(screen.getByTestId("cart-total").textContent).toBe("79.97"); // 19.99 + 59.98
  });

  it("updates item quantity via updateItem", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("1"));

    fireEvent.click(screen.getByText("Update guest-1"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items[0].quantity).toBe(5);
      expect(items[0].subtotal).toBeCloseTo(99.95, 2);
    });
    expect(parseFloat(screen.getByTestId("cart-total").textContent)).toBeCloseTo(99.95, 2);
  });

  it("removes an item from guest cart", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    fireEvent.click(screen.getByText("Add Gadget"));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("cart-items").textContent)).toHaveLength(2);
    });

    fireEvent.click(screen.getByText("Remove guest-1"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items).toHaveLength(1);
      expect(items[0].product_name).toBe("Gadget");
    });
    expect(screen.getByTestId("item-count").textContent).toBe("2");
  });

  it("shows toast on removeItem", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("1"));

    fireEvent.click(screen.getByText("Remove guest-1"));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Item removed from cart", "info");
    });
  });

  it("clears the entire guest cart", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    fireEvent.click(screen.getByText("Add Gadget"));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("cart-items").textContent)).toHaveLength(2);
    });

    fireEvent.click(screen.getByText("Clear"));

    await waitFor(() => {
      const items = JSON.parse(screen.getByTestId("cart-items").textContent);
      expect(items).toHaveLength(0);
    });
    expect(screen.getByTestId("item-count").textContent).toBe("0");
    expect(screen.getByTestId("cart-total").textContent).toBe("0");
  });

  it("shows toast on clear", async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("1"));

    fireEvent.click(screen.getByText("Clear"));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Cart cleared", "info");
    });
  });
});

describe("CartProvider — authenticated mode", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "testuser" } });
    mockAuthFetch.mockResolvedValue({
      items: [
        { id: 42, product: 1, product_name: "Server Item", unit_price: 9.99, quantity: 3, subtotal: 29.97 },
      ],
      total: 29.97,
      item_count: 3,
    });
  });

  it("loads server cart on mount", async () => {
    renderCart();
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/cart/");
    });
    await waitFor(() => {
      expect(screen.getByTestId("item-count").textContent).toBe("3");
    });
    const items = JSON.parse(screen.getByTestId("cart-items").textContent);
    expect(items).toHaveLength(1);
    expect(items[0].product_name).toBe("Server Item");
  });

  it("addItem calls authFetch POST /cart-items/", async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], total: 0, item_count: 0 });
    mockAuthFetch.mockResolvedValueOnce({ items: [], total: 0, item_count: 0 });
    mockAuthFetch.mockResolvedValueOnce({
      items: [{ id: 99, product: 1, product_name: "Widget", unit_price: 19.99, quantity: 1, subtotal: 19.99 }],
      total: 19.99,
      item_count: 1,
    });

    renderCart();
    await waitFor(() => expect(screen.getByTestId("item-count").textContent).toBe("0"));

    fireEvent.click(screen.getByText("Add Widget"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/cart-items/", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ product: 1, quantity: 1 }),
      }));
    });
  });

  it("updateItem calls authFetch PATCH /cart-items/{id}/", async () => {
    renderCart();
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    mockAuthFetch.mockResolvedValue({
      items: [{ id: 42, product: 1, product_name: "Server Item", unit_price: 9.99, quantity: 5, subtotal: 49.95 }],
      total: 49.95,
      item_count: 5,
    });

    fireEvent.click(screen.getByText("Update guest-1"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/cart-items\/.+\/$/),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quantity: 5 }),
        }),
      );
    });
  });

  it("removeItem calls authFetch DELETE /cart-items/{id}/", async () => {
    renderCart();
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    mockAuthFetch.mockResolvedValue({ items: [], total: 0, item_count: 0 });

    fireEvent.click(screen.getByText("Remove guest-1"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/cart-items\/.+\/$/),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(mockToast).toHaveBeenCalledWith("Item removed from cart", "info");
  });

  it("clear calls authFetch POST /cart/clear/", async () => {
    renderCart();
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    mockAuthFetch.mockResolvedValue({ items: [], total: 0, item_count: 0 });

    fireEvent.click(screen.getByText("Clear"));

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/cart/clear/", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(mockToast).toHaveBeenCalledWith("Cart cleared", "info");
  });
});
