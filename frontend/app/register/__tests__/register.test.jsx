import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockRouter } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ user: null, loading: false, register: vi.fn() })),
  mockRouter: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock("../../components/AuthPanel", () => ({ default: () => <div data-testid="auth-panel" /> }));
vi.mock("../../components/AuthBackButton", () => ({ default: () => <button type="button" data-testid="back-button">Back</button> }));
vi.mock("../../components/GoogleButton", () => ({ default: ({ action }) => <div data-testid="google-button">{action}</div> }));

import RegisterPage from "../page";

function fillStep1(screen) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: "Jane" } });
  fireEvent.change(screen.getByLabelText(/^last name/i), { target: { value: "Doe" } });
  fireEvent.change(screen.getAllByLabelText(/password/i)[0], { target: { value: "Password1" } });
  fireEvent.change(screen.getAllByLabelText(/confirm password/i)[0], { target: { value: "Password1" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null, loading: false, register: vi.fn() });
});

describe("RegisterPage — step 1", () => {
  it("renders all step 1 fields", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^last name/i)).toBeInTheDocument();
    const passwordInputs = screen.getAllByLabelText(/password/i);
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toHaveTextContent("Sign up");
  });

  it("shows validation errors on empty submit", () => {
    render(<RegisterPage />);
    fireEvent.submit(screen.getByLabelText(/email/i).closest("form"));
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/you must agree/i)).toBeInTheDocument();
  });

  it("shows password mismatch error", () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], { target: { value: "Password1" } });
    fireEvent.change(screen.getAllByLabelText(/confirm password/i)[0], { target: { value: "Different1" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("shows link to login", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});

describe("RegisterPage — step 2", () => {
  it("transitions to step 2 after valid step 1", async () => {
    render(<RegisterPage />);
    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/pick a username/i)).toBeInTheDocument();
    });
  });

  it("renders step 2 fields", async () => {
    render(<RegisterPage />);
    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows username validation error for invalid input", async () => {
    render(<RegisterPage />);
    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/3–20 characters/i)).toBeInTheDocument();
    });
  });

  it("redirects to /products on successful registration", async () => {
    const register = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, register });
    render(<RegisterPage />);

    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "janedoe" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalled();
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/products");
  });

  it("shows server error on failed registration", async () => {
    const register = vi.fn().mockRejectedValue(new Error("Username already taken."));
    mockUseAuth.mockReturnValue({ user: null, loading: false, register });
    render(<RegisterPage />);

    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "janedoe" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Username already taken.");
    });
  });

  it("back button returns to step 1", async () => {
    render(<RegisterPage />);

    fillStep1(screen);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/pick a username/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /go back/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    });
  });
});
