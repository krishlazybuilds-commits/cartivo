import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockRouter, mockUseAuth, mockAuthFetch, mockPathname } = vi.hoisted(() => {
  const mockRouter = { replace: vi.fn(), push: vi.fn() };
  let mockPathname = "/admin";
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

vi.mock("../../components/ConfirmDialog", () => ({
  default: ({ open, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <button type="button" onClick={onCancel}>{cancelLabel || "Cancel"}</button>
        <button
          type="button"
          data-testid="confirm-action"
          className={destructive ? "btn-danger" : "btn-primary"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

import AdminUsersPage from "../page";

const staffUser = { id: 1, username: "admin", is_staff: true, is_superuser: true };
const sampleUsers = [
  { id: 2, username: "jane", email: "jane@test.com", first_name: "Jane", last_name: "Doe", is_active: true, is_staff: false, is_superuser: false, date_joined: "2026-01-15T00:00:00Z" },
  { id: 3, username: "bob", email: "bob@test.com", first_name: "Bob", last_name: "", is_active: false, is_staff: true, is_superuser: false, date_joined: "2026-03-01T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.set("/admin");
});

describe("AdminUsersPage — auth guard", () => {
  it("redirects to /login?next=/admin when not authenticated", async () => {
    render(<AdminUsersPage />);
    await waitFor(() => { expect(mockRouter.replace).toHaveBeenCalledWith("/login?next=/admin"); });
  });

  it("redirects to / when user is not staff", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, username: "user", is_staff: false }, loading: false });
    render(<AdminUsersPage />);
    await waitFor(() => { expect(mockRouter.replace).toHaveBeenCalledWith("/"); });
  });

  it("renders nothing while auth loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AdminUsersPage />);
    expect(container.innerHTML).toBe("");
  });
});

describe("AdminUsersPage — rendering", () => {
  it("renders heading and description", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/account management/i)).toBeInTheDocument();
    expect(screen.getByText(/manage user accounts/i)).toBeInTheDocument();
  });

  it("renders AdminTabs with Users link", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminUsersPage />);
    const usersLink = await screen.findByRole("link", { name: /users/i });
    expect(usersLink).toBeInTheDocument();
    expect(usersLink).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/admin/catalog");
  });

  it("shows loading indicator while fetching", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AdminUsersPage />);
    await waitFor(() => expect(container.querySelector(".skeleton")).toBeInTheDocument());
  });

  it("shows error on fetch failure", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockRejectedValue({ data: { message: "Failed to load." } });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });

  it("shows empty state when no users", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });
});

describe("AdminUsersPage — user table", () => {
  it("renders user rows with data", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("jane")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("jane@test.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows (you) indicator for current user", async () => {
    const selfUser = { ...staffUser };
    mockUseAuth.mockReturnValue({ user: selfUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [selfUser], count: 1 });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/you/i)).toBeInTheDocument();
  });

  it("renders action buttons for each user", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("Deactivate")).toBeInTheDocument();
    expect(screen.getByText("Activate")).toBeInTheDocument();
    expect(screen.getByText("Make admin")).toBeInTheDocument();
    expect(screen.getByText("Revoke admin")).toBeInTheDocument();
    expect(screen.getAllByText("Delete")).toHaveLength(2);
  });

  it("disables controls for self user", async () => {
    const selfUser = { id: 1, username: "admin", is_staff: true, is_superuser: true };
    mockUseAuth.mockReturnValue({ user: selfUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [selfUser], count: 1 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("admin")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    const controlBtns = buttons.filter(b => /deactivate|activate|revoke|make admin|delete/i.test(b.textContent || ""));
    controlBtns.forEach((btn) => expect(btn).toBeDisabled());
  });
});

describe("AdminUsersPage — pagination", () => {
  function manyUsers(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: i + 2, username: `user${i}`, email: "", first_name: "", last_name: "", is_active: true, is_staff: false, is_superuser: false, date_joined: null,
    }));
  }

  it("shows pagination when count exceeds page size", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: manyUsers(20), count: 25 });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/page.*1.*of.*2/i)).toBeInTheDocument();
    expect(screen.getByText(/next/i)).toBeInTheDocument();
  });

  it("navigates to next page", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    const users = manyUsers(25);
    mockAuthFetch.mockResolvedValue({ results: users.slice(0, 20), count: 25 });
    render(<AdminUsersPage />);
    expect(await screen.findByText(/next/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/next/i));
    await waitFor(() => { expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining("page=2")); });
  });
});

describe("AdminUsersPage — actions", () => {
  it("opens confirm dialog on deactivate click", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("Deactivate")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/deactivate user/i)).toBeInTheDocument();
  });

  it("patches user on confirm", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    const patched = { ...sampleUsers[0], is_active: false };
    render(<AdminUsersPage />);
    expect(await screen.findByText("Deactivate")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    fireEvent.click(screen.getByTestId("confirm-action"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/auth/admin/users/2/", {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
    });
  });

  it("opens confirm on delete and removes user", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("jane")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Delete")[0]);
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-action"));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/auth/admin/users/2/", { method: "DELETE" });
    });
  });

  it("shows error on action failure", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: sampleUsers, count: 2 });
    render(<AdminUsersPage />);
    expect(await screen.findByText("Deactivate")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Deactivate")[0]);
    mockAuthFetch.mockRejectedValueOnce({ data: { message: "Action failed." } });
    fireEvent.click(screen.getByTestId("confirm-action"));
    expect(await screen.findByText(/action failed/i)).toBeInTheDocument();
  });
});

describe("AdminUsersPage — search", () => {
  it("renders search input", async () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminUsersPage />);
    expect(await screen.findByPlaceholderText(/search by username/i)).toBeInTheDocument();
  });

  it("debounces search query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false });
    mockAuthFetch.mockResolvedValue({ results: [] });
    render(<AdminUsersPage />);
    expect(await screen.findByPlaceholderText(/search by username/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search by username/i), { target: { value: "jane" } });
    vi.advanceTimersByTime(500);
    await waitFor(() => { expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining("search=jane")); });
    vi.useRealTimers();
  });
});
