import { test, expect } from "@playwright/test";

test("homepage loads with correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cartivo/);
});

test("homepage shows main sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /shop the future/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /why cartivo/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /shop now/i })).toBeVisible();
});

test("homepage has working navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /shop/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /blog/i })).toBeVisible();
});

test("homepage renders footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
