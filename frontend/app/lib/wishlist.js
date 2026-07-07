"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

import { authFetch } from "./auth";
import { useAuth } from "./auth";
import { useToast } from "./toast";

const WishlistContext = createContext(null);

const GUEST_WISHLIST_KEY = "cartivo_guest_wishlist";

function readGuestWishlist() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeGuestWishlist(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
}

/**
 * Wishlist state for the user. Supports guest mode using localStorage.
 * When the user logs in, guest wishlist items are merged into their account on the backend.
 */
export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems(readGuestWishlist());
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
    if (user) {
      const guestItems = readGuestWishlist();
      if (guestItems.length > 0) {
        // Merge guest wishlist items into server cart
        (async () => {
          setLoading(true);
          for (const item of guestItems) {
            try {
              await authFetch("/wishlist/", {
                method: "POST",
                body: JSON.stringify({ product: item.product }),
              });
            } catch {
              // Best effort
            }
          }
          writeGuestWishlist([]);
          await refresh();
        })();
      } else {
        refresh();
      }
    } else {
      setItems(readGuestWishlist());
    }
  }, [user, refresh]);

  const isWishlisted = useCallback(
    (productId) => items.some((i) => String(i.product) === String(productId)),
    [items]
  );

  const add = useCallback(async (productId, productData = null) => {
    if (user) {
      const created = await authFetch("/wishlist/", {
        method: "POST",
        body: JSON.stringify({ product: productId }),
      });
      setItems((prev) => [created, ...prev]);
    } else {
      const guestItems = readGuestWishlist();
      if (!guestItems.some((i) => String(i.product) === String(productId))) {
        const newItem = {
          id: `guest-${productId}`,
          product: productId,
          product_name: productData?.name ?? `Product #${productId}`,
          product_slug: productData?.slug ?? "",
          product_price: productData?.price ?? "0.00",
          product_image: productData?.image ?? null,
          added_at: new Date().toISOString(),
        };
        guestItems.unshift(newItem);
        writeGuestWishlist(guestItems);
        setItems(guestItems);
      }
    }
  }, [user]);

  const remove = useCallback(
    async (productId) => {
      if (user) {
        const item = items.find((i) => String(i.product) === String(productId));
        if (!item) return;
        await authFetch(`/wishlist/${item.id}/`, { method: "DELETE" });
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        const guestItems = readGuestWishlist().filter((i) => String(i.product) !== String(productId));
        writeGuestWishlist(guestItems);
        setItems(guestItems);
      }
    },
    [user, items]
  );

  // Remove by wishlist-item id (used on the wishlist page itself).
  const removeById = useCallback(async (itemId) => {
    if (user) {
      await authFetch(`/wishlist/${itemId}/`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      const guestItems = readGuestWishlist().filter((i) => i.id !== itemId);
      writeGuestWishlist(guestItems);
      setItems(guestItems);
    }
  }, [user]);

  /** Toggle a product in/out of the wishlist. */
  const toggle = useCallback(
    async (productId, productData = null) => {
      try {
        if (isWishlisted(productId)) {
          await remove(productId);
          toast("Removed from wishlist", "info");
        } else {
          await add(productId, productData);
          toast("Saved to wishlist", "success");
        }
      } catch (err) {
        toast(err.message || "Couldn't update your wishlist", "error");
      }
    },
    [isWishlisted, add, remove, toast]
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

/**
 * Custom hook to consume the wishlist context.
 * Useful for checking if an item is wishlisted, toggling wishlist state, and managing wishlist items.
 *
 * @returns {object} The wishlist context value containing items, loading state, count, and actions.
 * @throws {Error} If consumed outside of a WishlistProvider.
 */
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
