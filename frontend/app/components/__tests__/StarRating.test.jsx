import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StarRating from "../StarRating";

describe("StarRating", () => {
  it("renders with default props", () => {
    const { container } = render(<StarRating />);
    expect(container.querySelector(".star-rating")).toBeInTheDocument();
  });

  it("displays correct aria-label for a given value", () => {
    render(<StarRating value={3.5} />);
    expect(screen.getByLabelText("Rated 3.5 out of 5")).toBeInTheDocument();
  });

  it("displays aria-label with 0.0 when value is 0", () => {
    render(<StarRating value={0} />);
    expect(screen.getByLabelText("Rated 0.0 out of 5")).toBeInTheDocument();
  });

  it("clamps value to 100% fill width when above 5", () => {
    const { container } = render(<StarRating value={10} />);
    const fill = container.querySelector(".star-rating-fill");
    expect(fill).toHaveStyle("width: 100%");
  });

  it("clamps value to 0% fill width when negative", () => {
    const { container } = render(<StarRating value={-1} />);
    const fill = container.querySelector(".star-rating-fill");
    expect(fill).toHaveStyle("width: 0%");
  });

  it("renders correct fill percentage for 3.5 out of 5", () => {
    const { container } = render(<StarRating value={3.5} />);
    const fill = container.querySelector(".star-rating-fill");
    expect(fill).toHaveStyle("width: 70%");
  });

  it("applies custom size prop as font-size", () => {
    const { container } = render(<StarRating value={4} size="2rem" />);
    expect(container.querySelector(".star-rating")).toHaveStyle("font-size: 2rem");
  });

  it("shows count when showCount is true and count is a number", () => {
    render(<StarRating value={4} count={12} />);
    expect(screen.getByText("4.0 (12)")).toBeInTheDocument();
  });

  it("shows 'No reviews' when count is 0", () => {
    render(<StarRating value={4} count={0} />);
    expect(screen.getByText("No reviews")).toBeInTheDocument();
  });

  it("hides count when showCount is false", () => {
    render(<StarRating value={4} count={12} showCount={false} />);
    expect(screen.queryByText("4.0 (12)")).not.toBeInTheDocument();
    expect(screen.queryByText("No reviews")).not.toBeInTheDocument();
  });

  it("hides count when count prop is not provided", () => {
    render(<StarRating value={4} />);
    expect(screen.queryByText("4.0 (4)")).not.toBeInTheDocument();
  });

  it("renders empty and fill spans with 5 stars each", () => {
    const { container } = render(<StarRating value={3} />);
    const empty = container.querySelector(".star-rating-empty");
    const fill = container.querySelector(".star-rating-fill");
    expect(empty.textContent).toBe("★★★★★");
    expect(fill.textContent).toBe("★★★★★");
  });
});
