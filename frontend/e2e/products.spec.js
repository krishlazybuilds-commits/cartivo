import { test, expect } from "@playwright/test";

test("products page loads and shows header", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /browse the catalog/i })).toBeVisible();
});

test("products page has working search input", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByPlaceholder("Search products…")).toBeVisible();
});

test("products page has sort and category filters", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
  await expect(page.getByText("Sort by")).toBeVisible();
});

test("product detail page for a known product", async ({ page }) => {
  const response = await page.goto("/products/apple-macbook-air-13-m4");
  expect(response.status()).toBeLessThan(400);
});
