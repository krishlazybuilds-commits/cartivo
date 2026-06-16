import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => { mockNotFound(); },
}));

import BlogPostPage from "../[slug]/page";

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderPage(slug) {
  const element = await BlogPostPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("BlogPostPage", () => {
  it("renders post title, author, and date", async () => {
    await renderPage("welcome-to-cartivo");
    expect(screen.getByText("Welcome to Cartivo — Your New Favorite Shop")).toBeInTheDocument();
    expect(screen.getByText("The Cartivo Team")).toBeInTheDocument();
    expect(screen.getByText("June 1, 2026")).toBeInTheDocument();
  });

  it("renders post excerpt", async () => {
    await renderPage("welcome-to-cartivo");
    expect(screen.getByText(/We're thrilled to announce the launch/)).toBeInTheDocument();
  });

  it("renders tags when present", async () => {
    await renderPage("welcome-to-cartivo");
    expect(screen.getByText("announcement")).toBeInTheDocument();
  });

  it("renders HTML content from markdown", async () => {
    await renderPage("welcome-to-cartivo");
    expect(screen.getByText(/What makes Cartivo different/)).toBeInTheDocument();
    expect(screen.getByText(/Curated collections/)).toBeInTheDocument();
  });

  it("renders back to blog link", async () => {
    await renderPage("welcome-to-cartivo");
    const backLink = screen.getByText("Back to blog");
    expect(backLink.closest("a")).toHaveAttribute("href", "/blog");
  });

  it("calls notFound for unknown slug", async () => {
    try {
      await renderPage("nonexistent");
    } catch {
      // Component throws via notFound()
    }
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders multiple tags for style guide post", async () => {
    await renderPage("style-guide-creating-the-perfect-capsule-wardrobe");
    expect(screen.getByText("style")).toBeInTheDocument();
    expect(screen.getByText("guides")).toBeInTheDocument();
  });

  it("renders markdown tables as HTML", async () => {
    await renderPage("style-guide-creating-the-perfect-capsule-wardrobe");
    expect(screen.getByText("Tops")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Outerwear")).toBeInTheDocument();
  });
});
