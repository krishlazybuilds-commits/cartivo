import { NextResponse } from "next/server";

/**
 * Routes that require authentication. Guests may view the cart and check out;
 * order history and profile still require a logged-in account.
 */
const PROTECTED_ROUTES = ["/orders", "/profile", "/admin"];

/**
 * Routes only for guests. If a user visits these while already authenticated,
 * they're redirected to /products.
 */
const GUEST_ONLY_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has("refresh_token");

  // Protect auth-required pages
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isProtected && !hasToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from guest-only pages
  const isGuestOnly = GUEST_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isGuestOnly && hasToken) {
    const productsUrl = request.nextUrl.clone();
    productsUrl.pathname = "/products";
    return NextResponse.redirect(productsUrl);
  }

  // Generate a per-request nonce for Content-Security-Policy.
  // Exposed via x-nonce so layout.js can apply it to the inline script.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const devHosts = isDev ? ["localhost:8000", "127.0.0.1:8000"] : [];
  const imgSrc = ["'self'", "blob:", "data:", ...devHosts];
  if (process.env.NEXT_PUBLIC_MEDIA_HOST) imgSrc.push(process.env.NEXT_PUBLIC_MEDIA_HOST);
  const connectSrc = ["'self'", ...devHosts, "api.stripe.com", "accounts.google.com"];
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' js.stripe.com accounts.google.com`,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' js.stripe.com accounts.google.com",
    "form-action 'self'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(request.headers), "x-nonce": nonce }) },
  });
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)).*)",
  ],
};
