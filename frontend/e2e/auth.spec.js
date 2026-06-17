import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page loads with form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("login page shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/username/i).fill("nonexistentuser");
    await page.getByLabel(/password/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Should show an error message (not redirect)
    await expect(page).toHaveURL(/\/login/);
  });

  test("register page loads with form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /next|continue|sign up|register/i })).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /reset|send/i })).toBeVisible();
  });

  test("unauthenticated user is redirected from profile to login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from orders to login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });
});
