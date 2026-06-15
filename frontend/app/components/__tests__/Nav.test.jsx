import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

const { mockUseAuth, mockUseCart, mockToast, mockPathnameRef } = vi.hoisted(() => {
  const mockLogout = vi.fn();
  return {
    mockUseAuth: vi.fn(() => ({
      user: null,
      loading: false,
      authed: false,
      displayName: "",
      logout: mockLogout,
    })),
    mockUseCart: vi.fn(() => ({ itemCount: 0 })),
    mockToast: vi.fn(),
    mockPathnameRef: { current: "/" },
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathnameRef.current,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: (...args) => mockUseAuth(...args),
}));

vi.mock("../../lib/cart", () => ({
  useCart: (...args) => mockUseCart(...args),
}));

vi.mock("../../lib/toast", () => ({
  useToast: () => mockToast,
}));

import Nav from "../Nav";

const authedUser = { id: 1, username: "TestUser", is_staff: false };
const staffUser = { id: 1, username: "AdminUser", is_staff: true };

beforeEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = "";
  mockPathnameRef.current = "/";
  mockUseAuth.mockReturnValue({ user: null, loading: false, authed: false, displayName: "", logout: vi.fn() });
  mockUseCart.mockReturnValue({ itemCount: 0 });
});

describe("Nav — rendering basics", () => {
  it("renders brand link", () => {
    render(<Nav />);
    expect(screen.getByLabelText("Cartivo home")).toBeInTheDocument();
    expect(screen.getByText("Cartivo")).toBeInTheDocument();
  });

  it("renders desktop navigation links", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Features" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blog" })).toBeInTheDocument();
  });

  it("renders mobile hamburger button", () => {
    render(<Nav />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });
});

describe("Nav — desktop link active state", () => {
  it("marks Shop as active on /products", () => {
    mockPathnameRef.current = "/products";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveClass("active");
  });

  it("marks Blog as active on /blog/some-post", () => {
    mockPathnameRef.current = "/blog/some-post";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Blog" })).toHaveClass("active");
  });

  it("does not mark any link active on /", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Shop" })).not.toHaveClass("active");
    expect(screen.getByRole("link", { name: "Blog" })).not.toHaveClass("active");
  });

  it("marks Categories active when on home page and #categories section is in view", () => {
    mockPathnameRef.current = "/";
    const origGetId = document.getElementById.bind(document);
    const mockEl = { getBoundingClientRect: () => ({ top: 100, bottom: 300 }) };
    document.getElementById = vi.fn((id) => (id === "categories" ? mockEl : origGetId(id)));
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Categories" })).toHaveClass("active");
    document.getElementById = origGetId;
  });
});

describe("Nav — unauthenticated state", () => {
  it("shows Sign in and Get started", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, authed: false, displayName: "", logout: vi.fn() });
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
  });

  it("does not show avatar or cart", () => {
    render(<Nav />);
    expect(screen.queryByLabelText("Account menu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Cart$/)).not.toBeInTheDocument();
  });
});

describe("Nav — authenticated state", () => {
  it("shows cart icon and orders icon", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    expect(screen.getByLabelText("Cart")).toBeInTheDocument();
    expect(screen.getByLabelText("Orders")).toBeInTheDocument();
  });

  it("shows avatar button with username initial", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    const avatarBtn = screen.getByLabelText("Account menu");
    expect(avatarBtn).toBeInTheDocument();
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("shows cart badge with item count", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    mockUseCart.mockReturnValue({ itemCount: 3 });
    render(<Nav />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByLabelText(/3 items/i)).toBeInTheDocument();
  });

  it("does not show cart badge when itemCount is 0", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    expect(screen.queryByLabelText(/0 items/i)).not.toBeInTheDocument();
  });

  it("shows loading state when authed but loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    expect(screen.getByLabelText("Cart")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });
});

describe("Nav — account menu", () => {
  it("opens on avatar click", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByLabelText("Account menu")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Wishlist" })).toBeInTheDocument();
  });

  it("shows username in account menu", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByText("TestUser")).toBeInTheDocument();
  });

  it("shows displayName if user has one", () => {
    mockUseAuth.mockReturnValue({ user: { ...authedUser, username: "" }, loading: false, authed: true, displayName: "Testy", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByText("Testy")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("does not show Admin link for non-staff users", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.queryByRole("menuitem", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows Admin link for staff users", () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByRole("menuitem", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("closes on outside click", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByLabelText("Account menu")).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(document.body);
    expect(screen.getByLabelText("Account menu")).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape key", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByLabelText("Account menu")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText("Account menu")).toHaveAttribute("aria-expanded", "false");
  });

  it("contains Sign out button", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("Nav — sign out modal", () => {
  it("opens when Sign out is clicked", async () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(screen.getByText("Sign out?")).toBeInTheDocument();
    });
    expect(screen.getByText(/you'll need to sign in again/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("calls logout and shows toast on confirm", async () => {
    const mockLogout = vi.fn();
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: mockLogout });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(screen.getByText("Sign out?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("Signed out successfully", "success");
  });

  it("closes modal on Cancel", async () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => {
      expect(screen.getByText("Sign out?")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).not.toHaveClass("open");
  });
});

describe("Nav — mobile drawer", () => {
  it("toggles open on hamburger click", () => {
    render(<Nav />);
    const hamburger = screen.getByLabelText("Open menu");
    fireEvent.click(hamburger);
    expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByText("Why Cartivo")).toBeInTheDocument();
  });

  it("shows Sign in and Get started for unauthenticated users", () => {
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: "Get started" }).length).toBeGreaterThanOrEqual(1);
  });

  it("shows authenticated links when user is logged in", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    mockUseCart.mockReturnValue({ itemCount: 2 });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getByText("Cart (2)")).toBeInTheDocument();
    expect(screen.getAllByText("Orders").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Wishlist").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Profile").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sign out").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show Admin link in drawer for non-staff", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin link in drawer for staff", () => {
    mockUseAuth.mockReturnValue({ user: staffUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("closes drawer when a link is clicked", () => {
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getAllByText("Shop")[1]);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("shows mobile Sign out button that opens sign out modal", async () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getAllByText("Sign out")[1]);
    await waitFor(() => {
      expect(screen.getByText("Sign out?")).toBeInTheDocument();
    });
  });

  it("closes drawer when Sign out is clicked (mobile)", async () => {
    mockUseAuth.mockReturnValue({ user: authedUser, loading: false, authed: true, displayName: "", logout: vi.fn() });
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getAllByText("Sign out")[1]);
    await waitFor(() => {
      expect(screen.getByText("Sign out?")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });
});

describe("Nav — body overflow lock", () => {
  it("sets body overflow to hidden when mobile menu is open", () => {
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body overflow when mobile menu is closed", () => {
    render(<Nav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    fireEvent.click(screen.getAllByText("Shop")[1]);
    expect(document.body.style.overflow).toBe("");
  });
});
