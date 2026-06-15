import { test, expect } from "@playwright/test";

test("blog page lists all posts", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByText("Welcome to Cartivo")).toBeVisible();
  await expect(page.getByText("Capsule Wardrobe")).toBeVisible();
  await expect(page.getByText("Sustainable Shopping")).toBeVisible();
});

test("blog post page renders content", async ({ page }) => {
  await page.goto("/blog/welcome-to-cartivo");
  await expect(page.getByRole("heading", { name: /welcome to cartivo/i })).toBeVisible();
  await expect(page.getByText("The Cartivo Team")).toBeVisible();
});

test("404 for unknown blog slug", async ({ page }) => {
  const response = await page.goto("/blog/nonexistent-post");
  expect(response.status()).toBe(404);
});
