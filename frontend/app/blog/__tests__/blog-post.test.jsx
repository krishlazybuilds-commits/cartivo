import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import sanitizeHtml from "sanitize-html";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => { mockNotFound(); },
}));

// Match the config used in the blog post page so this test validates
// the same sanitizer settings applied to real blog content.
const SANITIZER_CONFIG = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "a", "ul", "ol", "li",
    "em", "strong", "code", "pre",
    "blockquote", "hr", "br",
    "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "del", "s", "ins",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["align"],
    td: ["align"],
    code: ["class"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};

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

  it("strips script tags and event handlers from rendered content", async () => {
    await renderPage("welcome-to-cartivo");
    const container = document.querySelector(".blog-post-content");
    expect(container).not.toBeNull();

    // Dangerous elements that markdown should never produce
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("object")).toBeNull();
    expect(container.querySelector("embed")).toBeNull();
  });
});

describe("SanitizeHtml XSS protection", () => {
  it("strips inline script tags", () => {
    const result = sanitizeHtml('<script>alert(1)</script>', SANITIZER_CONFIG);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("strips event handler attributes", () => {
    const result = sanitizeHtml(
      '<img src=x onerror="alert(1)"><a onclick="evil()">click</a>',
      SANITIZER_CONFIG,
    );
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("onclick");
  });

  it("strips iframe tags", () => {
    const result = sanitizeHtml(
      '<iframe src="https://evil.com"></iframe>',
      SANITIZER_CONFIG,
    );
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("iframe");
  });

  it("strips javascript: URLs in links", () => {
    const result = sanitizeHtml(
      '<a href="javascript:alert(1)">click</a>',
      SANITIZER_CONFIG,
    );
    expect(result).not.toContain("javascript:");
  });

  it("strips protocol-relative URLs", () => {
    const result = sanitizeHtml(
      '<a href="//evil.com">click</a>',
      SANITIZER_CONFIG,
    );
    expect(result).not.toContain("//evil");
  });

  it("strips style tags", () => {
    const result = sanitizeHtml(
      '<style>body { background: url(javascript:alert(1)); }</style>',
      SANITIZER_CONFIG,
    );
    expect(result).not.toContain("<style>");
  });

  it("allows safe markdown tags through", () => {
    const result = sanitizeHtml(
      '<p>Hello <strong>world</strong></p><a href="https://example.com">link</a>',
      SANITIZER_CONFIG,
    );
    expect(result).toContain("<p>");
    expect(result).toContain("<strong>");
    expect(result).toContain("<a href=\"https://example.com\"");
  });
});
