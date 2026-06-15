import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockRouter, mockSearchParams } = vi.hoisted(() => ({
  mockRouter: { push: vi.fn(), replace: vi.fn() },
  mockSearchParams: { get: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../../lib/api", () => ({
  API_URL: "http://localhost:8000/api",
}));

vi.mock("../../components/AuthPanel", () => ({
  default: () => <div data-testid="auth-panel" />,
}));

import ResetPasswordPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  mockSearchParams.get.mockImplementation((key) => {
    if (key === "uid") return "MQ";
    if (key === "token") return "abc123";
    return null;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResetPasswordPage", () => {
  it("renders heading, password fields, and submit button", async () => {
    render(<ResetPasswordPage />);
    expect(await screen.findByRole("heading", { name: /set new password/i })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/password/i).length).toBe(2);
    expect(screen.getByRole("button", { name: /set new password/i })).toBeInTheDocument();
  });

  it("renders auth panel and logo link", async () => {
    render(<ResetPasswordPage />);
    expect(await screen.findByTestId("auth-panel")).toBeInTheDocument();
    expect(screen.getByText("Cartivo").closest("a")).toHaveAttribute("href", "/");
  });

  it("shows error when passwords do not match", async () => {
    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "Different1" } });
    fireEvent.click(btn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("shows Saving… while submitting", async () => {
    let resolvePromise;
    global.fetch.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
    fireEvent.click(btn);

    expect(await screen.findByRole("button", { name: /saving…/i })).toBeDisabled();
    resolvePromise({ ok: true });
  });

  it("sends uid, token, and new_password to the API", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/auth/password-reset/confirm/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: "MQ", token: "abc123", new_password: "StrongPass1" }),
        })
      );
    });
  });

  it("shows success message", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
    fireEvent.click(btn);

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it("shows API error message", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: "Invalid or expired link." }),
    });

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
    fireEvent.click(btn);

    expect(await screen.findByText(/invalid or expired link/i)).toBeInTheDocument();
  });

  it("shows generic error when fetch fails", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });
    fireEvent.click(btn);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("redirects to login after 2 seconds", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(<ResetPasswordPage />);
    const btn = await screen.findByRole("button", { name: /set new password/i });
    const inputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass1" } });

    vi.useFakeTimers();
    fireEvent.click(btn);

    await act(async () => {});
    expect(screen.getByText(/password updated/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(2000); });
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });
});
