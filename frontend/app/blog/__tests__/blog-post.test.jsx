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

describe("BlogPostPage", () => {
  it("renders post title, author, and date", () => {
    render(<BlogPostPage params={{ slug: "welcome-to-cartivo" }} />);
    expect(screen.getByText("Welcome to Cartivo — Your New Favorite Shop")).toBeInTheDocument();
    expect(screen.getByText("The Cartivo Team")).toBeInTheDocument();
    expect(screen.getByText("June 1, 2026")).toBeInTheDocument();
  });

  it("renders post excerpt", () => {
    render(<BlogPostPage params={{ slug: "welcome-to-cartivo" }} />);
    expect(screen.getByText(/We're thrilled to announce the launch/)).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    render(<BlogPostPage params={{ slug: "welcome-to-cartivo" }} />);
    expect(screen.getByText("announcement")).toBeInTheDocument();
  });

  it("renders HTML content from markdown", () => {
    render(<BlogPostPage params={{ slug: "welcome-to-cartivo" }} />);
    expect(screen.getByText(/What makes Cartivo different/)).toBeInTheDocument();
    expect(screen.getByText(/Curated collections/)).toBeInTheDocument();
  });

  it("renders back to blog link", () => {
    render(<BlogPostPage params={{ slug: "welcome-to-cartivo" }} />);
    const backLink = screen.getByText("Back to blog");
    expect(backLink.closest("a")).toHaveAttribute("href", "/blog");
  });

  it("calls notFound for unknown slug", () => {
    try {
      render(<BlogPostPage params={{ slug: "nonexistent" }} />);
    } catch {
      // React catches the error internally
    }
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders multiple tags for style guide post", () => {
    render(<BlogPostPage params={{ slug: "style-guide-creating-the-perfect-capsule-wardrobe" }} />);
    expect(screen.getByText("style")).toBeInTheDocument();
    expect(screen.getByText("guides")).toBeInTheDocument();
  });

  it("renders markdown tables as HTML", () => {
    render(<BlogPostPage params={{ slug: "style-guide-creating-the-perfect-capsule-wardrobe" }} />);
    expect(screen.getByText("Tops")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Outerwear")).toBeInTheDocument();
  });
});
