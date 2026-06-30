import { test, expect } from "@playwright/test";

test("homepage loads with correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cartivo/);
});

test("homepage shows main sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /sound, vision and everyday tech/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /tech shopping without the worry/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop now" })).toBeVisible();
});

test("homepage has working navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Shop", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Blog", exact: true }).first()).toBeVisible();
});

test("homepage renders footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
