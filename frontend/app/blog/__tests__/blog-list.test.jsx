import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

import BlogPage from "../page";

describe("BlogPage", () => {
  it("renders the blog heading and description", () => {
    render(<BlogPage />);
    expect(screen.getByText("Stories & ideas")).toBeInTheDocument();
    expect(screen.getByText(/Style guides, sustainability tips/)).toBeInTheDocument();
  });

  it("renders all blog post cards", () => {
    render(<BlogPage />);
    expect(screen.getByText("Welcome to Cartivo — Your New Favorite Shop")).toBeInTheDocument();
    expect(screen.getByText("Style Guide: Creating the Perfect Capsule Wardrobe")).toBeInTheDocument();
    expect(screen.getByText("Sustainable Shopping: How to Make Eco-Friendly Choices")).toBeInTheDocument();
  });

  it("renders post excerpts", () => {
    render(<BlogPage />);
    expect(screen.getByText(/We're thrilled to announce the launch/)).toBeInTheDocument();
  });

  it("renders formatted dates", () => {
    render(<BlogPage />);
    expect(screen.getByText("June 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("June 8, 2026")).toBeInTheDocument();
    expect(screen.getByText("June 12, 2026")).toBeInTheDocument();
  });

  it("renders tags for posts that have them", () => {
    render(<BlogPage />);
    expect(screen.getByText("announcement")).toBeInTheDocument();
    expect(screen.getByText("style")).toBeInTheDocument();
    expect(screen.getAllByText("guides")).toHaveLength(2);
    expect(screen.getByText("sustainability")).toBeInTheDocument();
  });

  it("renders read more links with correct hrefs", () => {
    render(<BlogPage />);
    const links = screen.getAllByText("Read more");
    expect(links).toHaveLength(3);
    expect(links[0].closest("a")).toHaveAttribute("href", "/blog/welcome-to-cartivo");
    expect(links[1].closest("a")).toHaveAttribute("href", "/blog/style-guide-creating-the-perfect-capsule-wardrobe");
    expect(links[2].closest("a")).toHaveAttribute("href", "/blog/sustainable-shopping-how-to-make-eco-friendly-choices");
  });

  it("renders eyebrow label", () => {
    render(<BlogPage />);
    expect(screen.getByText("Blog")).toBeInTheDocument();
  });
});
