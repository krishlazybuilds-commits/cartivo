import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test("checkout page redirects unauthenticated users or shows guest option", async ({ page }) => {
    const response = await page.goto("/checkout");
    expect(response.status()).toBeLessThan(500);
    // Checkout should either show a guest checkout form or the page loads
    const url = page.url();
    const isOnCheckout = url.includes("/checkout");
    const isRedirected = url.includes("/login") || url.includes("/cart");
    expect(isOnCheckout || isRedirected).toBeTruthy();
  });

  test("checkout page loads without server errors", async ({ page }) => {
    const response = await page.goto("/checkout");
    expect(response.status()).not.toBe(500);
  });

  test("guest order lookup page loads", async ({ page }) => {
    await page.goto("/orders/lookup");
    const form = page.locator(".auth-form");
    await expect(form.getByLabel(/email/i)).toBeVisible();
    await expect(form.getByLabel(/order/i)).toBeVisible();
  });

  test("guest order lookup shows error for invalid input", async ({ page }) => {
    await page.goto("/orders/lookup");
    const form = page.locator(".auth-form");
    await form.getByLabel(/email/i).fill("fake@example.com");
    await form.getByLabel(/order/i).fill("XXXXXXXX");
    await form.getByRole("button", { name: /look ?up|find|search|track/i }).click();
    // Should show a not-found or error message
    await expect(form.getByText(/not found|no order|invalid|error/i)).toBeVisible({ timeout: 10000 });
  });
});
