"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";

export default function AddToCart({ productId, inStock }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | adding | added | error
  const [message, setMessage] = useState(null);

  async function handleAdd() {
    if (!user) {
      router.push("/login");
      return;
    }
    setStatus("adding");
    setMessage(null);
    try {
      await addItem(productId, 1);
      setStatus("added");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
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
      <button
        className="btn btn-primary"
        onClick={handleAdd}
        disabled={status === "adding"}
        type="button"
      >
        {status === "adding"
          ? "Adding…"
          : status === "added"
          ? "Added ✓"
          : "Add to cart"}
      </button>
      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
