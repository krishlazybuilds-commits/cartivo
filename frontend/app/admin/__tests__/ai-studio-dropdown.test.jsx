import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { mockUseAuth, mockAuthFetch } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
  mockAuthFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/ai-studio",
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
  extractError: (data, fallback) => data?.message || fallback || "Something went wrong.",
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/ConfirmDialog", () => ({
  default: () => null,
}));

import AdminAiStudioPage from "../ai-studio/page";

const staffUser = { id: 1, username: "admin", is_staff: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
  mockAuthFetch.mockResolvedValue({ results: [] });
});

describe("AdminAiStudioPage — dropdowns render", () => {
  it("renders Aspect Ratio and Model labels", async () => {
    render(<AdminAiStudioPage />);
    expect(await screen.findByText("Aspect Ratio")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
  });

  it("renders both dropdown trigger buttons", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Aspect Ratio");
    const triggers = screen.getAllByRole("button", { name: /1:1|gemini|veo/i });
    expect(triggers.length).toBeGreaterThanOrEqual(2);
  });

  it("opens Aspect Ratio options on click", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Aspect Ratio");
    // The trigger shows the selected label "1:1"
    fireEvent.click(screen.getByText("1:1"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const items = screen.getAllByRole("option");
    expect(items.length).toBeGreaterThan(1);
  });

  it("portals the dropdown list to document.body (escapes Reveal/stacking context)", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Aspect Ratio");
    fireEvent.click(screen.getByText("1:1"));
    const listbox = screen.getByRole("listbox");
    // Portaled to <body> so will-change/overflow on ancestors can't clip it.
    expect(listbox.parentNode).toBe(document.body);
  });

  it("opens Model options on click", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Model");
    fireEvent.click(screen.getByText(/gemini.*image/i));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes the dropdown when clicking an option", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Aspect Ratio");
    fireEvent.click(screen.getByText("1:1"));
    const items = screen.getAllByRole("option");
    const sixteenNine = items.find((i) => i.textContent.includes("16:9"));
    fireEvent.click(sixteenNine);
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("closes the dropdown when clicking outside", async () => {
    render(<AdminAiStudioPage />);
    await screen.findByText("Aspect Ratio");
    fireEvent.click(screen.getByText("1:1"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});
