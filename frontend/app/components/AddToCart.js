"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { useToast } from "../lib/toast";

export default function AddToCart({ productId, inStock }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState("idle"); // idle | adding | added | error

  function decrement() {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function increment() {
    setQuantity((q) => q + 1);
  }

  async function handleAdd() {
    if (!user) {
      router.push("/login");
      return;
    }
    setStatus("adding");
    try {
      await addItem(productId, quantity);
      setStatus("added");
      toast(`Added ${quantity} to cart`, "success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      toast(err.message || "Couldn't add to cart", "error");
    }
  }

  if (!inStock) {
    return (
      <button className="btn btn-ghost" disabled type="button">
        Out of stock
      </button>
    );
  }

  return (
    <div className="add-to-cart">
      <div className="qty-selector">
        <button
          type="button"
          className="qty-btn"
          onClick={decrement}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="qty-value" aria-live="polite" aria-label={`Quantity: ${quantity}`}>
          {quantity}
        </span>
        <button
          type="button"
          className="qty-btn"
          onClick={increment}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleAdd}
        disabled={status === "adding"}
        type="button"
      >
        {status === "adding" ? "Adding…" : status === "added" ? "Added ✓" : "Add to cart"}
      </button>
    </div>
  );
}
