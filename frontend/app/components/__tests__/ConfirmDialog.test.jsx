import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDialog open={false} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(container.querySelector(".modal-overlay")).not.toBeInTheDocument();
  });

  it("renders the dialog when open is true", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("displays default title and custom message", () => {
    render(
      <ConfirmDialog
        open={true}
        message="Do you want to proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Do you want to proceed?")).toBeInTheDocument();
  });

  it("displays custom title", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete item?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
  });

  it("does not render message paragraph when no message prop", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when overlay is clicked", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("presentation"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel when dialog interior is clicked", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("alertdialog"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("displays custom confirm and cancel labels", () => {
    render(
      <ConfirmDialog
        open={true}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText("Yes, delete")).toBeInTheDocument();
    expect(screen.getByText("No, keep")).toBeInTheDocument();
  });

  it("applies btn-danger class when destructive is true", () => {
    render(
      <ConfirmDialog
        open={true}
        destructive={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.classList.contains("btn-danger")).toBe(true);
    expect(confirmBtn.classList.contains("btn-primary")).toBe(false);
  });

  it("applies btn-primary class when destructive is false", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.classList.contains("btn-primary")).toBe(true);
    expect(confirmBtn.classList.contains("btn-danger")).toBe(false);
  });

  it("locks body scroll when open", () => {
    render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when unmounted", () => {
    const { unmount } = render(
      <ConfirmDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />
    );
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("renders alertdialog with correct aria attributes", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Warning"
        message="Something important"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-title");
    expect(dialog).toHaveAttribute("aria-describedby", "confirm-message");
  });
});
