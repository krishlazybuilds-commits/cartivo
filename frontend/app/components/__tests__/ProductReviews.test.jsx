import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockToast, mockAuthFetch, testUrl } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null })),
  mockToast: vi.fn(),
  mockAuthFetch: vi.fn(),
  testUrl: "http://test.local/api",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../../lib/api", () => ({
  API_URL: testUrl,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
}));

vi.mock("../../lib/toast", () => ({
  useToast: () => mockToast,
}));

vi.mock("../StarRating", () => ({
  default: ({ value, count, showCount = true, size }) => (
    <span data-testid="star-rating" data-value={value} data-count={count} data-showcount={String(showCount)} data-size={size}>
      {value} / 5{showCount && count != null ? ` (${count})` : ""}
    </span>
  ),
}));

import ProductReviews from "../ProductReviews";

const sampleReviews = [
  { id: 1, rating: 5, username: "Alice", created_at: "2025-06-01T12:00:00Z", title: "Great!", body: "Really loved it." },
  { id: 2, rating: 3, username: "Bob", created_at: "2025-05-15T08:00:00Z", title: "Okay", body: "It was fine." },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  mockUseAuth.mockReturnValue({ user: null });
  mockAuthFetch.mockResolvedValue({});
});

function mockFetchReviews(reviews) {
  global.fetch.mockResolvedValue({
    json: () => Promise.resolve({ results: reviews }),
  });
}

describe("ProductReviews — loading and empty", () => {
  it("shows loading state initially", () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<ProductReviews productId={1} />);
    expect(screen.getByText("Loading reviews…")).toBeInTheDocument();
  });

  it("shows empty state when no reviews", async () => {
    mockFetchReviews([]);
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });
});

describe("ProductReviews — review list", () => {
  it("renders reviews with author, rating, date, title, body", async () => {
    mockFetchReviews(sampleReviews);
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
    expect(screen.getByText("Great!")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(screen.getByText("Really loved it.")).toBeInTheDocument();
    expect(screen.getByText("It was fine.")).toBeInTheDocument();
  });

  it("shows star rating aggregate with count", async () => {
    mockFetchReviews(sampleReviews);
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId("star-rating")).toHaveAttribute("data-count", "2");
    });
    expect(screen.getByTestId("star-rating")).toHaveAttribute("data-value", "4");
  });

  it("does not show aggregate rating when count is 0", async () => {
    mockFetchReviews([]);
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("star-rating")).not.toBeInTheDocument();
  });

  it("handles API fetch failure gracefully", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });

  it("renders review without optional title or body", async () => {
    const minimalReview = [{ id: 3, rating: 4, username: "Charlie", created_at: "2025-04-01T12:00:00Z", title: "", body: "" }];
    mockFetchReviews(minimalReview);
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });
});

describe("ProductReviews — auth guard", () => {
  it("shows sign-in prompt when not authenticated", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: null });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows already-reviewed message when user has reviewed", async () => {
    mockFetchReviews(sampleReviews);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "Alice" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/already reviewed/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /post review/i })).not.toBeInTheDocument();
  });

  it("shows review form when authenticated and not yet reviewed", async () => {
    mockFetchReviews(sampleReviews);
    mockUseAuth.mockReturnValue({ user: { id: 2, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
  });
});

describe("ProductReviews — star input", () => {
  it("renders 5 star buttons", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText("1 star")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("2 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("3 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("5 stars")).toBeInTheDocument();
  });

  it("sets rating on click", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText("3 stars")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("3 stars"));
    expect(screen.getByLabelText("3 stars")).toHaveAttribute("aria-pressed", "true");
  });

  it("highlights on hover", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
    });
    fireEvent.mouseEnter(screen.getByLabelText("4 stars"));
    expect(screen.getByLabelText("4 stars")).toHaveClass("on");
  });

  it("clears hover on mouse leave", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText("4 stars")).toBeInTheDocument();
    });
    fireEvent.mouseEnter(screen.getByLabelText("4 stars"));
    fireEvent.mouseLeave(screen.getByLabelText("4 stars"));
    expect(screen.getByLabelText("4 stars")).not.toHaveClass("on");
  });
});

describe("ProductReviews — form submission", () => {
  it("shows toast when submitting without rating", async () => {
    mockFetchReviews([]);
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /post review/i }));
    expect(mockToast).toHaveBeenCalledWith("Please pick a star rating", "info");
  });

  it("calls authFetch and shows success toast on submit", async () => {
    mockFetchReviews([]);
    mockAuthFetch.mockResolvedValue({});
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: "Nice" } });
    fireEvent.change(screen.getByPlaceholderText(/share your thoughts/i), { target: { value: "Great product" } });
    fireEvent.click(screen.getByRole("button", { name: /post review/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/reviews/", {
        method: "POST",
        body: JSON.stringify({ product: 1, rating: 4, title: "Nice", body: "Great product" }),
      });
    });
    expect(mockToast).toHaveBeenCalledWith("Thanks for your review!", "success");
  });

  it("shows error toast when authFetch fails", async () => {
    mockFetchReviews([]);
    mockAuthFetch.mockRejectedValue(new Error("Server error"));
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.click(screen.getByRole("button", { name: /post review/i }));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Server error", "error");
    });
  });

  it("disables submit button while submitting", async () => {
    mockFetchReviews([]);
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.click(screen.getByRole("button", { name: /post review/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /posting/i })).toBeDisabled();
    });
  });

  it("resets form fields after successful submit", async () => {
    mockFetchReviews([]);
    mockAuthFetch.mockResolvedValue({});
    mockUseAuth.mockReturnValue({ user: { id: 1, username: "NewUser" } });
    render(<ProductReviews productId={1} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: "Nice" } });
    fireEvent.change(screen.getByPlaceholderText(/share your thoughts/i), { target: { value: "Great!" } });
    fireEvent.click(screen.getByRole("button", { name: /post review/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalled();
    });
    expect(screen.getByPlaceholderText(/title/i)).toHaveValue("");
    expect(screen.getByPlaceholderText(/share your thoughts/i)).toHaveValue("");
    expect(screen.getByLabelText("4 stars")).toHaveAttribute("aria-pressed", "false");
  });
});
