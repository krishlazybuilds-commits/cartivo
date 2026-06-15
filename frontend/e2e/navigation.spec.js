import { test, expect } from "@playwright/test";

test("navigates to blog page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /blog/i }).first().click();
  await expect(page).toHaveURL(/\/blog/);
  await expect(page.getByRole("heading", { name: /stories/i })).toBeVisible();
});

test("navigates to about page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /about/i }).first().click();
  await expect(page).toHaveURL(/\/about/);
  await expect(page.getByRole("heading", { name: /about cartivo/i })).toBeVisible();
});

test("navigates to products page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /shop/i }).first().click();
  await expect(page).toHaveURL(/\/products/);
});

test("navigates to contact page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /contact/i }).first().click();
  await expect(page).toHaveURL(/\/contact/);
});

test("navigates to terms page from footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: /terms/i }).click();
  await expect(page).toHaveURL(/\/terms/);
});

test("navigates to privacy page from footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: /privacy/i }).click();
  await expect(page).toHaveURL(/\/privacy/);
});
