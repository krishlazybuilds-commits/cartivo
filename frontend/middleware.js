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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/orders/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
