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
  const [status, setStatus] = useState("idle"); // idle | adding | added | error

  async function handleAdd() {
    if (!user) {
      router.push("/login");
      return;
    }
    setStatus("adding");
    try {
      await addItem(productId, 1);
      setStatus("added");
      toast("Added to cart", "success");
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
    <button
      className="btn btn-primary"
      onClick={handleAdd}
      disabled={status === "adding"}
      type="button"
    >
      {status === "adding" ? "Adding…" : status === "added" ? "Added ✓" : "Add to cart"}
    </button>
  );
}
