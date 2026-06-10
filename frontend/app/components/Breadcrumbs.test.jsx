import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumbs from "./Breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders nothing when given no items", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders links for non-final items and marks the last as current", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/products" },
          { label: "Cool Widget" },
        ]}
      />
    );

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("href", "/");

    const current = screen.getByText("Cool Widget");
    expect(current).toHaveAttribute("aria-current", "page");
    // The final item should not be a link.
    expect(screen.queryByRole("link", { name: "Cool Widget" })).toBeNull();
  });

  it("exposes an accessible breadcrumb landmark", () => {
    render(<Breadcrumbs items={[{ label: "Home", href: "/" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});
