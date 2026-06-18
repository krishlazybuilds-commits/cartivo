import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockRouter, mockUseAuth, mockAuthFetch, mockPathname } = vi.hoisted(() => {
  const mockRouter = { replace: vi.fn(), push: vi.fn() };
  let mockPathname = "/admin/reviews";
  return {
    mockRouter,
    mockUseAuth: vi.fn(() => ({ user: null, loading: false })),
    mockAuthFetch: vi.fn(),
    mockPathname: { get: () => mockPathname, set: (v) => { mockPathname = v; } },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname.get(),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
  extractError: (data, fallback) => data?.message || fallback || "Something went wrong.",
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

import AdminReviewsPage from "../reviews/page";

const staffUser = { id: 1, username: "admin", is_staff: true, is_superuser: true };
const sampleReviews = [
  { id: 1, product: 1, product_name: "Widget", username: "Alice", rating: 5, title: "Great", body: "Love it", status: "pending", created_at: "2026-06-01T12:00:00Z" },
  { id: 2, product: 1, product_name: "Widget", username: "Bob", rating: 3, title: "OK", body: "Fine", status: "approved", created_at: "2026-05-15T08:00:00Z" },
  { id: 3, product: 2, product_name: "Gadget", username: "Charlie", rating: 1, title: "Bad", body: "Terrible", status: "rejected", created_at: "2026-04-10T10:00:00Z" },
];

describe("AdminReviewsPage — auth guard", () => {
  it("redirects unauthenticated users to login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<AdminReviewsPage />);
    expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=/admin/reviews");
  });

  it("redirects non-staff users to home", () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, username: "normal", is_staff: false }, loading: false });
    render(<AdminReviewsPage />);
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("renders nothing while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AdminReviewsPage />);
    expect(container.innerHTML).toBe("");
  });
});

describe("AdminReviewsPage — review list", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleReviews });
  });

  it("fetches reviews on mount with default pending filter", async () => {
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/?status=pending");
    });
  });

  it("renders review rows in the table", async () => {
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Widget").length).toBe(2);
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows status badges with correct text", async () => {
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
    });
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("rejected")).toBeInTheDocument();
  });

  it("shows approve/reject buttons only for pending reviews", async () => {
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Approve").length).toBe(1);
    });
    expect(screen.getAllByText("Reject").length).toBe(1);
  });

  it("refetches when status filter changes", async () => {
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/?status=pending");
    });
    mockAuthFetch.mockClear();
    fireEvent.click(screen.getByText("Approved"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/?status=approved");
    });
  });

  it("shows empty state when no reviews", async () => {
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("No reviews found.")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockAuthFetch.mockRejectedValue(new Error("Failed to load"));
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });
});

describe("AdminReviewsPage — approve/reject actions", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleReviews });
  });

  it("calls approve endpoint and updates status", async () => {
    mockAuthFetch.mockResolvedValueOnce({ results: sampleReviews });
    mockAuthFetch.mockResolvedValueOnce({ detail: "Review approved." });
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("Approve")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/1/approve/", { method: "POST" });
    });
  });

  it("calls reject endpoint and updates status", async () => {
    mockAuthFetch.mockResolvedValueOnce({ results: sampleReviews });
    mockAuthFetch.mockResolvedValueOnce({ detail: "Review rejected." });
    render(<AdminReviewsPage />);
    await waitFor(() => {
      expect(screen.getByText("Reject")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Reject"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/1/reject/", { method: "POST" });
    });
  });
});
