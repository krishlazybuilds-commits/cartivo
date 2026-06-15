import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

const pages = [
  { name: "AboutPage", path: "../about/page", slug: "/about", heading: "About Cartivo" },
  { name: "TermsPage", path: "../terms/page", slug: "/terms", heading: "Terms of Service" },
  { name: "PrivacyPage", path: "../privacy/page", slug: "/privacy", heading: "Privacy Policy" },
  { name: "SecurityPage", path: "../security/page", slug: "/security", heading: "Security" },
  { name: "RoadmapPage", path: "../roadmap/page", slug: "/roadmap", heading: "Coming soon" },
  { name: "ThemesPage", path: "../themes/page", slug: "/themes", heading: "Coming soon" },
];

describe.each(pages)("$name", ({ name, path, slug, heading }) => {
  it("renders without crashing", async () => {
    const mod = await import(path);
    const Page = mod.default || mod[name];
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("renders the page heading", async () => {
    const mod = await import(path);
    const Page = mod.default || mod[name];
    render(<Page />);
    expect(screen.getByText(heading)).toBeInTheDocument();
  });
});
