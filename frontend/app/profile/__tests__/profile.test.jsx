import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

const { mockRouter, mockUseAuth, mockAuthFetch, mockLogout } = vi.hoisted(() => {
  const mockRouter = { replace: vi.fn(), push: vi.fn() };
  const mockLogout = vi.fn();
  return {
    mockRouter,
    mockUseAuth: vi.fn(() => ({ user: null, loading: false, logout: mockLogout })),
    mockAuthFetch: vi.fn(),
    mockLogout,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
  authFetch: (...args) => mockAuthFetch(...args),
  extractError: (data, fallback) => data?.message || fallback || "Something went wrong.",
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../../components/PasswordInput", () => ({
  default: ({ value, onChange, autoComplete, required, minLength }) => (
    <input
      type="password"
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      minLength={minLength}
      data-testid="password-input"
    />
  ),
}));

import ProfilePage from "../page";

const sampleUser = {
  username: "janedoe",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  phone: "+1234567890",
};

const authedMock = () => ({ user: sampleUser, loading: false, logout: mockLogout });

beforeEach(() => {
  vi.clearAllMocks();
  delete window.location;
  window.location = { href: "" };
});

describe("ProfilePage — auth guard", () => {
  it("redirects to /login when not authenticated", async () => {
    render(<ProfilePage />);
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders nothing while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, logout: mockLogout });
    const { container } = render(<ProfilePage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while auth is loading even with user", () => {
    mockUseAuth.mockReturnValue({ user: sampleUser, loading: true, logout: mockLogout });
    const { container } = render(<ProfilePage />);
    expect(container.innerHTML).toBe("");
  });
});

describe("ProfilePage — personal info form", () => {
  it("renders heading and section title", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    render(<ProfilePage />);
    expect(await screen.findByText(/your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/personal information/i)).toBeInTheDocument();
  });

  it("pre-fills form fields with user data", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    // Email is shown as read-only text, not an input field
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+1234567890")).toBeInTheDocument();
  });

  it("saves profile info on submit", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({
          username: sampleUser.username,
          first_name: sampleUser.first_name,
          last_name: sampleUser.last_name,
          phone: sampleUser.phone,
        }),
      });
    });
  });

  it("shows success message after saving", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
  });

  it("shows error message on save failure", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockRejectedValue({ data: { message: "Email already taken." } });
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/email already taken/i)).toBeInTheDocument();
  });

  it("shows Saving… while submitting info", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });
});

describe("ProfilePage — change password", () => {
  it("renders change password heading and fields", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    render(<ProfilePage />);
    expect(await screen.findByRole("heading", { name: /change password/i })).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    expect(pwInputs).toHaveLength(2);
  });

  it("changes password on submit", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "current123" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/auth/me/password/", {
        method: "POST",
        body: JSON.stringify({ current_password: "current123", new_password: "newPass123" }),
      });
    });
  });

  it("shows success message after password change", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "current123" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/password changed/i)).toBeInTheDocument();
  });

  it("clears password fields after success", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "current123" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => { expect(mockAuthFetch).toHaveBeenCalled(); });
    await waitFor(() => {
      expect(pwInputs[0].value).toBe("");
      expect(pwInputs[1].value).toBe("");
    });
  });

  it("shows error message on password change failure", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockRejectedValue({ data: { message: "Wrong current password." } });
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "wrong" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/wrong current password/i)).toBeInTheDocument();
  });

  it("shows Saving… while changing password", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "current123" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });

  it("redirects to login after 1500ms on success", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    mockAuthFetch.mockResolvedValue({});
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("janedoe")).toBeInTheDocument();
    const pwInputs = screen.getAllByTestId("password-input");
    fireEvent.change(pwInputs[0], { target: { value: "current123" } });
    fireEvent.change(pwInputs[1], { target: { value: "newPass123" } });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await Promise.resolve();
    expect(mockAuthFetch).toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(mockLogout).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
    vi.useRealTimers();
  });
});

describe("ProfilePage — quick links", () => {
  it("renders View orders link", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    render(<ProfilePage />);
    expect(await screen.findByText(/your profile/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view orders/i })).toHaveAttribute("href", "/orders");
  });

  it("calls logout on Sign out click", async () => {
    mockUseAuth.mockReturnValue(authedMock());
    render(<ProfilePage />);
    expect(await screen.findByText(/your profile/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockLogout).toHaveBeenCalled();
  });
});
