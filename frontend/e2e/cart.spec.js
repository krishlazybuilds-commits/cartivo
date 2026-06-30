import { test, expect } from "@playwright/test";

test.describe("Cart", () => {
  test("cart page loads and shows empty state", async ({ page }) => {
    await page.goto("/cart");
    // Cart should load without errors
    const response = await page.goto("/cart");
    expect(response.status()).toBeLessThan(400);
  });

  test("cart page shows empty message when no items", async ({ page }) => {
    await page.goto("/cart");
    // Should show some indication the cart is empty
    await expect(page.getByText(/empty|no items|start shopping/i)).toBeVisible();
  });

  test("add to cart button exists on product page", async ({ page }) => {
    await page.goto("/products/apple-macbook-air-13-m4");
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });

  test("cart link in navigation shows cart icon", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Cart", exact: true })).toBeVisible();
  });
});
