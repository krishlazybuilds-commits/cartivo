import { describe, it, expect } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats a number as USD currency", () => {
    expect(formatPrice(10)).toBe("$10.00");
  });

  it("formats a numeric string", () => {
    expect(formatPrice("1234.5")).toBe("$1,234.50");
  });

  it("rounds to two decimal places", () => {
    expect(formatPrice(9.999)).toBe("$10.00");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });
});
