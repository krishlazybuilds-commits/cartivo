const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

// Default revalidation period for catalog data (seconds). Catalog pages are
// served from cache and revalidated in the background at this interval (ISR).
// Override per-call via options.next.revalidate. Set to 0 or pass
// { cache: "no-store" } for real-time data.
const DEFAULT_REVALIDATE = 60;

/**
 * Fetch JSON from the Cartivo backend API with ISR caching by default.
 *
 * @param {string} path - e.g. "/products/" or "/products/some-slug/"
 * @param {RequestInit & { next?: { revalidate?: number, tags?: string[] } }} options
 */
export async function apiFetch(path, options = {}) {
  const { next, ...fetchOptions } = options;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(fetchOptions.headers || {}) },
    ...fetchOptions,
    // Next.js extended fetch: enable ISR with tag-based on-demand revalidation.
    next: {
      revalidate: DEFAULT_REVALIDATE,
      ...next,
    },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  // 204 No Content has no body to parse.
  return res.status === 204 ? null : res.json();
}

/**
 * Fetch a shipping + tax estimate from the backend.
 * Works for both guests and authenticated users.
 * NOT cached (pricing depends on request-time input).
 * @param {string} country
 * @param {number|string} subtotal
 */
export async function fetchShippingEstimate(country, subtotal) {
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
