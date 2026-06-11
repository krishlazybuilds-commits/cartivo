"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

import { authFetch } from "./auth";
import { useAuth } from "./auth";
import { useToast } from "./toast";

const WishlistContext = createContext(null);

/**
 * Wishlist state for the signed-in user. Unlike the cart there is no guest
 * mode — saving items requires an account. Items are loaded from the backend
 * (`/wishlist/`) when the user logs in and cleared on logout.
 */
export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await authFetch("/wishlist/");
      setItems(data.results ?? data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sync whenever auth state changes (login loads, logout clears).
  useEffect(() => {
    refresh();
  }, [refresh]);

  const isWishlisted = useCallback(
    (productId) => items.some((i) => i.product === productId),
    [items]
  );

  const add = useCallback(async (productId) => {
    const created = await authFetch("/wishlist/", {
      method: "POST",
      body: JSON.stringify({ product: productId }),
    });
    setItems((prev) => [created, ...prev]);
  }, []);

  const remove = useCallback(
    async (productId) => {
      const item = items.find((i) => i.product === productId);
      if (!item) return;
      await authFetch(`/wishlist/${item.id}/`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [items]
  );

  // Remove by wishlist-item id (used on the wishlist page itself).
  const removeById = useCallback(async (itemId) => {
    await authFetch(`/wishlist/${itemId}/`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  /** Toggle a product in/out of the wishlist. Prompts guests to sign in. */
  const toggle = useCallback(
    async (productId) => {
      if (!user) {
        toast("Sign in to save items to your wishlist", "info");
        return;
      }
      try {
        if (isWishlisted(productId)) {
          await remove(productId);
          toast("Removed from wishlist", "info");
        } else {
          await add(productId);
          toast("Saved to wishlist", "success");
        }
      } catch (err) {
        toast(err.message || "Couldn't update your wishlist", "error");
      }
    },
    [user, isWishlisted, add, remove, toast]
  );

  const count = items.length;

  return (
    <WishlistContext.Provider
      value={{ items, loading, count, isWishlisted, toggle, removeById, refresh }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
