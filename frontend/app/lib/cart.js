"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

import { authFetch } from "./auth";
import { useAuth } from "./auth";
import { useToast } from "./toast";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      const data = await authFetch("/cart/");
      setCart(data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load (or clear) the cart whenever the logged-in user changes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId, quantity = 1) => {
      await authFetch("/cart-items/", {
        method: "POST",
        body: JSON.stringify({ product: productId, quantity }),
      });
      await refresh();
    },
    [refresh]
  );

  const updateItem = useCallback(
    async (itemId, quantity) => {
      await authFetch(`/cart-items/${itemId}/`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId) => {
      await authFetch(`/cart-items/${itemId}/`, { method: "DELETE" });
      await refresh();
      toast("Item removed from cart", "info");
    },
    [refresh, toast]
  );

  const clear = useCallback(async () => {
    await authFetch("/cart/clear/", { method: "POST" });
    await refresh();
    toast("Cart cleared", "info");
  }, [refresh, toast]);

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
