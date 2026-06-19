/**
 * Simple in-memory sliding-window rate limiter.
 * NOT shared across serverless instances (each instance has its own Map).
 * Suitable for defense-in-depth on endpoints already protected by a secret.
 */
const hits = new Map();

export function rateLimit({ key, windowMs, max }) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > windowMs) {
    hits.set(key, { start: now, count: 1 });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > max) {
    return { allowed: false, retryAfter: Math.ceil((entry.start + windowMs - now) / 1000) };
  }
  return { allowed: true };
}
