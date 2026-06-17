import { test, expect } from "@playwright/test";

test.describe("Search", () => {
  test("search page loads", async ({ page }) => {
    const response = await page.goto("/search");
    expect(response.status()).toBeLessThan(400);
  });

  test("search with a query shows results or empty state", async ({ page }) => {
    await page.goto("/search?q=test");
    // Should show either results or a no-results message
    const hasContent =
      (await page.getByText(/no results|no products|nothing found/i).count()) > 0 ||
      (await page.locator("[data-testid='product-card'], .product-card, article").count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  test("categories page loads", async ({ page }) => {
    const response = await page.goto("/categories");
    expect(response.status()).toBeLessThan(400);
  });
});
