const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/**
 * Fetch JSON from the Cartivo backend API.
 * @param {string} path - e.g. "/products/" or "/products/some-slug/"
 * @param {RequestInit} options - standard fetch options
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }

  // 204 No Content has no body to parse.
  return res.status === 204 ? null : res.json();
}

export { API_URL };
