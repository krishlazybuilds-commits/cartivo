"use client";

import { useState } from "react";
import { authFetch } from "../lib/auth";

export default function CouponInput({ subtotal, couponData, onApply, onError }) {
  const [couponCode, setCouponCode] = useState(couponData?.code || "");
  const [validating, setValidating] = useState(false);

  async function handleApply() {
    if (!couponCode.trim()) return;
    setValidating(true);
    onError(null);
    try {
      const data = await authFetch("/coupons/validate/", {
        method: "POST",
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      if (data.valid) {
        onApply(data);
      } else {
        onError(data.message || "Invalid coupon code.");
        onApply(null);
      }
    } catch {
      onError("Failed to validate coupon.");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="coupon-field" style={{ marginTop: "1rem" }}>
      <label style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>Coupon code</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Enter code"
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleApply}
          disabled={validating || !couponCode.trim()}
          style={{ padding: "0 1.5rem" }}
        >
          {validating ? "…" : "Apply"}
        </button>
      </div>
      {couponData && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--success, #16a34a)" }}>
          {couponData.message}
        </p>
      )}
    </div>
  );
}
