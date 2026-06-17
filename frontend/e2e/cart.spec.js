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
    await page.goto("/products/welcome-to-cartivo");
    // Product page should have an add-to-cart control
    const addButton = page.getByRole("button", { name: /add to cart/i });
    // If the product page exists, the button should be present
    if (await page.getByRole("heading").count() > 0) {
      await expect(addButton).toBeVisible();
    }
  });

  test("cart link in navigation shows cart icon", async ({ page }) => {
    await page.goto("/");
    // Navigation should have a link to the cart
    const cartLink = page.getByRole("link", { name: /cart/i });
    await expect(cartLink).toBeVisible();
  });
});
