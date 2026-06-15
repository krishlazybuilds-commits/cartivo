import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SortSelect from "../SortSelect";

const options = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

function renderSort(props = {}) {
  return render(<SortSelect value="newest" options={options} onChange={vi.fn()} {...props} />);
}

describe("SortSelect — rendering", () => {
  it("renders trigger with selected option label", () => {
    renderSort();
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("renders label text", () => {
    renderSort({ label: "Order by" });
    expect(screen.getByText("Order by")).toBeInTheDocument();
  });

  it("menu is closed by default", () => {
    renderSort();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens menu on trigger click", () => {
    renderSort();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("renders all options in the menu", () => {
    renderSort();
    fireEvent.click(screen.getByRole("button"));
    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Newest");
    expect(items[1]).toHaveTextContent("Price: Low to High");
  });

  it("marks selected option with aria-selected", () => {
    renderSort({ value: "price_asc" });
    fireEvent.click(screen.getByRole("button"));
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
  });

  it("marks selected option with check icon", () => {
    renderSort({ value: "price_asc" });
    fireEvent.click(screen.getByRole("button"));
    const items = screen.getAllByRole("option");
    expect(items[1].querySelector(".sort-select-check")).toBeInTheDocument();
    expect(items[0].querySelector(".sort-select-check")).not.toBeInTheDocument();
  });

  it("trigger has correct aria attributes", () => {
    renderSort();
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("SortSelect — open/close behavior", () => {
  it("closes when clicking outside", () => {
    renderSort();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when clicking an option", () => {
    const onChange = vi.fn();
    renderSort({ onChange });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getAllByRole("option")[2]);
    expect(onChange).toHaveBeenCalledWith("price_desc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("calls onChange with option value when selected", () => {
    const onChange = vi.fn();
    renderSort({ onChange });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getAllByRole("option")[3]);
    expect(onChange).toHaveBeenCalledWith("rating");
  });
});

describe("SortSelect — keyboard navigation", () => {
  it("opens menu on ArrowDown", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens menu on ArrowUp", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowUp" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens menu on Enter", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens menu on Space", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("moves active option on ArrowDown", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveClass("active");
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    expect(items[0]).not.toHaveClass("active");
    expect(items[1]).toHaveClass("active");
  });

  it("moves active option on ArrowUp", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveClass("active");
  });

  it("selects active option on Enter", () => {
    const onChange = vi.fn();
    renderSort({ onChange });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("price_asc");
  });

  it("closes menu on Escape", () => {
    renderSort();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("highlights option on mouse enter", () => {
    renderSort();
    fireEvent.click(screen.getByRole("button"));
    const items = screen.getAllByRole("option");
    fireEvent.mouseEnter(items[2]);
    expect(items[2]).toHaveClass("active");
    expect(items[0]).not.toHaveClass("active");
  });
});

describe("SortSelect — edge cases", () => {
  it("uses first option when value does not match any option", () => {
    renderSort({ value: "nonexistent" });
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("wraps active index at bounds on ArrowDown at last", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[3]).toHaveClass("active");
  });

  it("wraps active index at bounds on ArrowUp at first", () => {
    renderSort();
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveClass("active");
  });

  it("adds open class to container when menu is open", () => {
    const { container } = renderSort();
    expect(container.querySelector(".sort-select")).not.toHaveClass("open");
    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector(".sort-select")).toHaveClass("open");
  });
});
