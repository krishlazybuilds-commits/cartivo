import { test, expect } from "@playwright/test";

test.describe("Wishlist", () => {
  test("wishlist page loads without errors", async ({ page }) => {
    const response = await page.goto("/wishlist");
    expect(response.status()).toBeLessThan(500);
  });

  test("wishlist page shows empty state for guest", async ({ page }) => {
    await page.goto("/wishlist");
    await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
  });
});
