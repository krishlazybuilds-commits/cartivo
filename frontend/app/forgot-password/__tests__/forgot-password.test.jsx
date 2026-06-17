import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../../lib/api", () => ({
  API_URL: "http://localhost:8000/api/v1",
}));

vi.mock("../../components/AuthPanel", () => ({
  default: () => <div data-testid="auth-panel" />,
}));

vi.mock("../../components/AuthBackButton", () => ({
  default: () => <button type="button" data-testid="back-button">Back</button>,
}));

import ForgotPasswordPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("ForgotPasswordPage", () => {
  it("renders heading, email field, and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("shows Sending… while submitting", async () => {
    let resolvePromise;
    global.fetch.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    expect(screen.getByRole("button", { name: /sending…/i })).toBeDisabled();
    resolvePromise({ ok: true });
  });

  it("shows success message after sending", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  });

  it("shows link back to sign in after success", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/login");
    });
  });

  it("shows error when fetch fails", async () => {
    global.fetch.mockResolvedValue({ ok: false });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("shows error when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("posts the email to the correct endpoint", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.submit(screen.getByRole("button", { name: /send reset link/i }).closest("form"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/auth/password-reset/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "jane@test.com" }),
        })
      );
    });
  });

  it("renders sign-in link for users who remember their password", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("renders back button and auth panel", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.getByTestId("auth-panel")).toBeInTheDocument();
  });
});
