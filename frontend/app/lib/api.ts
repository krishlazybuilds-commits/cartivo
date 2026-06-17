const API_URL: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Default revalidation period for catalog data (seconds). Catalog pages are
// served from cache and revalidated in the background at this interval (ISR).
// Override per-call via options.next.revalidate. Set to 0 or pass
// { cache: "no-store" } for real-time data.
const DEFAULT_REVALIDATE = 60;

interface ApiFetchOptions extends RequestInit {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
}

/**
 * Fetch JSON from the Cartivo backend API with ISR caching by default.
 *
 * @param path - e.g. "/products/" or "/products/some-slug/"
 * @param options - fetch options with optional Next.js `next` config
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T | null> {
  const { next, ...fetchOptions } = options;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(fetchOptions.headers || {}) },
    ...fetchOptions,
    // Next.js extended fetch: enable ISR with tag-based on-demand revalidation.
    next: {
      revalidate: DEFAULT_REVALIDATE,
      ...next,
    },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  // 204 No Content has no body to parse.
  return res.status === 204 ? null : res.json();
}

interface ShippingEstimate {
  shipping: number;
  tax: number;
  total: number;
}

/**
 * Fetch a shipping + tax estimate from the backend.
 * Works for both guests and authenticated users.
 * NOT cached (pricing depends on request-time input).
 */
export async function fetchShippingEstimate(country: string, subtotal: number | string): Promise<ShippingEstimate | null> {
  if (!country || !subtotal) return null;
  try {
    const res = await fetch(`${API_URL}/shipping-estimate/`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, subtotal }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export { API_URL };
