import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

vi.mock("../../lib/api", () => ({
  API_URL: "http://localhost:8000/api",
}));

vi.mock("../../components/Reveal", () => ({
  default: ({ children }) => <>{children}</>,
}));

import ContactPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@test.com" } });
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Hello, I have a question." } });
}

describe("ContactPage", () => {
  it("renders the heading and form fields", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { name: /contact me/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("shows Sending… while submitting", async () => {
    let resolvePromise;
    global.fetch.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    expect(screen.getByRole("button", { name: /sending…/i })).toBeDisabled();
    resolvePromise({ ok: true });
  });

  it("shows success message after successful submission", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeInTheDocument();
    });
  });

  it("clears form fields after successful submission", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue("");
      expect(screen.getByLabelText(/email/i)).toHaveValue("");
      expect(screen.getByLabelText(/message/i)).toHaveValue("");
    });
  });

  it("shows error message when submission fails", async () => {
    global.fetch.mockResolvedValue({ ok: false });

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("shows error message when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("posts the form data to the correct endpoint", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    render(<ContactPage />);
    fillForm();
    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/contact/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Jane Doe",
            email: "jane@test.com",
            message: "Hello, I have a question.",
          }),
        })
      );
    });
  });

  it("requires all fields", () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/message/i)).toBeRequired();
  });

  it("allows resubmission after error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));
    global.fetch.mockResolvedValueOnce({ ok: true });

    render(<ContactPage />);
    fillForm();

    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole("button", { name: /send message/i }).closest("form"));
    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeInTheDocument();
    });
  });
});
