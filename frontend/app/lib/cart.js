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
  const refreshGuest = useCallback(async () => {
    const items = readGuestCart();
    setCart(guestCartToState(items));

    if (items.length === 0) return;

    const productIds = Array.from(new Set(items.map((i) => i.product_id)));
    try {
      const res = await fetch(`/api/v1/products/?ids=${productIds.join(",")}&page_size=${productIds.length}`);
      if (res.ok) {
        const data = await res.json();
        const products = data.results ?? data;
        const priceMap = {};
        const imageMap = {};
        for (const p of products) {
          priceMap[p.id] = parseFloat(p.price);
          imageMap[p.id] = p.image || null;
          if (p.variants) {
            for (const v of p.variants) {
              priceMap[`${p.id}-${v.id}`] = parseFloat(v.effective_price ?? v.price ?? p.price);
            }
          }
        }

        let changed = false;
        const updatedItems = items.map((item) => {
          const key = item.variant_id ? `${item.product_id}-${item.variant_id}` : item.product_id;
          const serverPrice = priceMap[key];
          const serverImage = imageMap[item.product_id] || null;

          let updatedItem = { ...item };
          let itemChanged = false;

          if (serverPrice !== undefined && serverPrice !== item.unit_price) {
            updatedItem.unit_price = serverPrice;
            updatedItem.subtotal = serverPrice * item.quantity;
            updatedItem.price_is_estimate = false;
            itemChanged = true;
          } else if (serverPrice !== undefined && item.price_is_estimate) {
            updatedItem.price_is_estimate = false;
            itemChanged = true;
          }

          if (serverImage !== undefined && serverImage !== item.product_image) {
            updatedItem.product_image = serverImage;
            itemChanged = true;
          }

          if (itemChanged) changed = true;
          return updatedItem;
        });

        if (changed) {
          writeGuestCart(updatedItems);
          setCart(guestCartToState(updatedItems));
        }
      }
    } catch {
      // Ignore: network/API offline, keep using the localStorage items as-is
    }
  }, []);

  const refresh = useCallback(async () => {
    if (user) {
      await refreshServer();
    } else {
      await refreshGuest();
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
        // Guest: store in localStorage. Price is fetched from the server so
        // guests cannot set their own price via localStorage tampering. If the
        // lookup fails we fall back to the client-provided price, which the
        // cart display labels as an estimate (checkout re-validates it).
        let serverPrice = null;
        let serverImage = null;
        try {
          const res = await fetch(`/api/v1/products/?ids=${productId}&page_size=1`);
          if (res.ok) {
            const data = await res.json();
            const product = (data.results ?? data)[0];
            if (product) {
              serverImage = product.image || null;
              if (productData.variantId && product.variants) {
                const v = product.variants.find((x) => x.id === productData.variantId);
                if (v) serverPrice = parseFloat(v.effective_price ?? v.price ?? product.price);
              } else {
                serverPrice = parseFloat(product.price);
              }
            }
          }
        } catch {
          // Network/API error — fall back below.
        }
        const price = serverPrice ?? productData.price ?? 0;
        const priceIsEstimate = serverPrice === null;
        const image = serverImage ?? productData.image ?? null;

        const items = readGuestCart();
        const guestKey = productData.variantId ? `guest-${productId}-${productData.variantId}` : `guest-${productId}`;
        const existing = items.find((i) => i.id === guestKey);
        if (existing) {
          existing.quantity += quantity;
          existing.subtotal = existing.unit_price * existing.quantity;
          existing.price_is_estimate = priceIsEstimate;
          if (image) existing.product_image = image;
        } else {
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
            price_is_estimate: priceIsEstimate,
            product_image: image,
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
