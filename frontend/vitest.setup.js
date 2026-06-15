import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Unmount React trees after each test to avoid cross-test leakage.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Default mock for next/navigation — individual test files can override as needed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => ({ get: () => null }),
}));
