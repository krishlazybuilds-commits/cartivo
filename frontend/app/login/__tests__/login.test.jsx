import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockToast, mockRouter, mockSearchParams } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false, login: vi.fn() })),
  mockToast: vi.fn(),
  mockRouter: { push: vi.fn(), replace: vi.fn() },
  mockSearchParams: { get: vi.fn(() => null) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock("../../lib/toast", () => ({
  useToast: () => mockToast,
}));

vi.mock("../../components/AuthPanel", () => ({ default: () => <div data-testid="auth-panel" /> }));
vi.mock("../../components/AuthBackButton", () => ({ default: () => <button type="button" data-testid="back-button">Back</button> }));
vi.mock("../../components/PasswordInput", () => ({
  default: ({ value, onChange, autoComplete, required }) => (
    <input
      type="password"
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      data-testid="password-input"
    />
  ),
}));
vi.mock("../../components/GoogleButton", () => ({ default: ({ action }) => <div data-testid="google-button">{action}</div> }));

import LoginPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn() });
  mockSearchParams.get.mockReturnValue(null);
});

describe("LoginPage", () => {
  it("renders heading and form elements", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByTestId("password-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.getByTestId("auth-panel")).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toHaveTextContent("Sign in");
  });

  it("renders links to register and forgot-password", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
  });

  it("calls login with entered credentials on submit", async () => {
    const login = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, login });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "jane" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("jane", "secret");
    });
  });

  it("shows success toast and redirects to /products on successful login", async () => {
    const login = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, login });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "jane" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Signed in successfully", "success");
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/products");
  });

  it("redirects to next param when present", async () => {
    mockSearchParams.get.mockReturnValue("/checkout");
    const login = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, login });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "jane" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/checkout");
    });
  });

  it("shows error alert on failed login", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Invalid credentials."));
    mockUseAuth.mockReturnValue({ user: null, loading: false, login });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "jane" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials.");
    });
  });

  it("shows Signing in… while submitting", async () => {
    let resolveLogin;
    const login = vi.fn(() => new Promise((resolve) => { resolveLogin = resolve; }));
    mockUseAuth.mockReturnValue({ user: null, loading: false, login });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "jane" } });
    fireEvent.submit(screen.getByLabelText(/username/i).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    resolveLogin();
  });
});
