"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

import { authFetch } from "./auth";
import { useAuth } from "./auth";
import { useToast } from "./toast";

const CartContext = createContext(null);

// ---------------------------------------------------------------------------
// Guest cart helpers (localStorage)
// ---------------------------------------------------------------------------
const GUEST_CART_KEY = "cartivo_guest_cart";

function readGuestCart() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

function guestCartToState(items) {
  // Shape: [{id, product_id, product_name, unit_price, quantity, subtotal}]
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  return { items, total, item_count: items.reduce((s, i) => s + i.quantity, 0) };
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refresh the cart from the server (authenticated users).
  const refreshServer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/cart/");
      setCart(data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload guest cart from localStorage.
  const refreshGuest = useCallback(() => {
    const items = readGuestCart();
    setCart(guestCartToState(items));
  }, []);

  const refresh = useCallback(async () => {
    if (user) {
      await refreshServer();
    } else {
      refreshGuest();
    }
  }, [user, refreshServer, refreshGuest]);

  // When auth state changes, sync the cart.
  // If a guest just logged in, merge their guest cart into the server cart,
  // then clear localStorage.
  useEffect(() => {
    if (user) {
      const guestItems = readGuestCart();
      if (guestItems.length > 0) {
        // Merge guest items into the server cart then clear.
        (async () => {
          setLoading(true);
          for (const item of guestItems) {
            try {
              const body = { product: item.product_id, quantity: item.quantity };
              if (item.variant_id) body.variant = item.variant_id;
              await authFetch("/cart-items/", {
                method: "POST",
                body: JSON.stringify(body),
              });
            } catch {
              // Best-effort; carry on with remaining items.
            }
          }
          writeGuestCart([]);
          await refreshServer();
        })();
      } else {
        refreshServer();
      }
    } else {
      refreshGuest();
    }
  }, [user, refreshServer, refreshGuest]);

  const addItem = useCallback(
    async (productId, quantity = 1, productData = {}) => {
      if (user) {
        const body = { product: productId, quantity };
        if (productData.variantId) body.variant = productData.variantId;
        await authFetch("/cart-items/", {
          method: "POST",
          body: JSON.stringify(body),
        });
        await refreshServer();
      } else {
        // Guest: store in localStorage.
        const items = readGuestCart();
        const guestKey = productData.variantId ? `guest-${productId}-${productData.variantId}` : `guest-${productId}`;
        const existing = items.find((i) => i.id === guestKey);
        if (existing) {
          existing.quantity += quantity;
          existing.subtotal = existing.unit_price * existing.quantity;
        } else {
          const price = productData.price ?? 0;
          items.push({
            id: guestKey,
            product_id: productId,
            product_name: productData.variantId
              ? `${productData.name} — ${productData.variantName ?? "Option"}`
              : (productData.name ?? `Product #${productId}`),
            unit_price: price,
            quantity,
            subtotal: price * quantity,
            variant_id: productData.variantId ?? null,
          });
        }
        writeGuestCart(items);
        refreshGuest();
      }
    },
    [user, refreshServer, refreshGuest]
  );

  // --- updateItem ------------------------------------------------------------
  const updateItem = useCallback(
    async (itemId, quantity) => {
      if (user) {
        await authFetch(`/cart-items/${itemId}/`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        });
        await refreshServer();
      } else {
        const items = readGuestCart().map((i) =>
          i.id === itemId
            ? { ...i, quantity, subtotal: i.unit_price * quantity }
            : i
        );
        writeGuestCart(items);
        refreshGuest();
      }
    },
    [user, refreshServer, refreshGuest]
  );

  // --- removeItem ------------------------------------------------------------
  const removeItem = useCallback(
    async (itemId) => {
      if (user) {
        await authFetch(`/cart-items/${itemId}/`, { method: "DELETE" });
        await refreshServer();
      } else {
        writeGuestCart(readGuestCart().filter((i) => i.id !== itemId));
        refreshGuest();
      }
      toast("Item removed from cart", "info");
    },
    [user, refreshServer, refreshGuest, toast]
  );

  // --- clear -----------------------------------------------------------------
  const clear = useCallback(async () => {
    if (user) {
      await authFetch("/cart/clear/", { method: "POST" });
      await refreshServer();
    } else {
      writeGuestCart([]);
      refreshGuest();
    }
    toast("Cart cleared", "info");
  }, [user, refreshServer, refreshGuest, toast]);

  const itemCount = cart?.item_count ?? 0;

  return (
    <CartContext.Provider
      value={{ cart, loading, itemCount, refresh, addItem, updateItem, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
