import { test, expect } from "@playwright/test";

test("blog page lists all posts", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: /welcome to cartivo/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /capsule wardrobe/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /sustainable shopping/i })).toBeVisible();
});

test("blog post page renders content", async ({ page }) => {
  await page.goto("/blog/welcome-to-cartivo");
  await expect(page.getByRole("heading", { name: /welcome to cartivo/i })).toBeVisible();
  await expect(page.getByText("The Cartivo Team")).toBeVisible();
});

test("unknown blog slug shows not-found page", async ({ page }) => {
  await page.goto("/blog/nonexistent-post");
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
});
