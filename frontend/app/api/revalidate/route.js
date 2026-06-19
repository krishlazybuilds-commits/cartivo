import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { rateLimit } from "../../lib/rate-limit";

/**
 * On-demand revalidation endpoint.
 *
 * Call POST /api/revalidate with a JSON body { "tag": "products", "secret": "..." }
 * to purge cached data for that tag instantly instead of waiting for the
 * DEFAULT_REVALIDATE interval.
 *
 * Protect with REVALIDATION_SECRET in production so only the backend or a
 * deploy hook can trigger it.
 *
 * Usage examples:
 *   { "tag": "products" }           — revalidate all product pages
 *   { "tag": "product-some-slug" }  — revalidate a specific product page
 *   { "tag": "categories" }         — revalidate all category pages
 */
export async function POST(request) {
  // Rate-limit by IP: 10 requests per minute as defense-in-depth.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfter } = rateLimit({
    key: `revalidate:${ip}`,
    windowMs: 60_000,
    max: 10,
  });
  if (!allowed) {
    return NextResponse.json(
      { revalidated: false, message: `Too many requests. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { tag, secret } = await request.json();

  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ revalidated: false, message: "Invalid secret" }, { status: 401 });
  }

  if (!tag) {
    return NextResponse.json({ revalidated: false, message: "Missing tag" }, { status: 400 });
  }

  revalidateTag(tag);

  return NextResponse.json({ revalidated: true, tag });
}
