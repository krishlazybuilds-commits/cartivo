# Cartivo Frontend & Design Gap Analysis

> Generated: 2026-06-29 | Total gaps: 94 | Severity: 1 Critical, 12 High, 35 Medium, 39 Low, 7 Cosmetic

---

## Critical / High Severity Issues

### `lib/cart.js:121` — Guest cart prices are client-authored
The price stored in `localStorage` is whatever the client sends. A malicious user could set `price: 0.01` and `localStorage` would store it. The cart display shows client-provided prices. While `checkout/page.js` re-validates (line 48-88), the displayed cart total is misleading throughout the session.

**Fix:** Fetch prices from the server for guest carts, or clearly label them as "estimated / subject to change."

---

### `app/cart/page.js:58-105` — Production debug logging left in
Extensive `console.log` calls and a `logLayout` helper that measures `document.documentElement.clientHeight`, `scrollY`, `body.offsetHeight`, etc. on every cart state change. The comment says "Debug logging for footer flicker investigation" — this is development code shipped to production. Causes unnecessary reflow measurements and leaks internal state.

**Fix:** Remove all debug logging or gate behind a build flag.

---

### `app/components/GalleryImages.js:15-19` — `mainImage` discarded when `images` array exists
```js
if (images.length > 0) {
  allImages = images;
}
```
If the API sends both `mainImage` (primary product image) and `images` (gallery), the primary image is lost. The `mainImage` should be prepended to the array.

**Fix:** Prepend `mainImage` to the images array: `allImages = [mainImage, ...images]`.

---

### `app/checkout/page.js:201` — Coupon discount ignored when shipping estimate absent
```js
estimate ? estimate.total - (couponData?.discount_amount || 0) : (cartTotal ?? 0)
```
When the shipping estimate hasn't loaded yet, `finalTotal` reverts to raw `cartTotal` without the coupon discount. The "Pay" button shows an incorrect total.

**Fix:** Always apply coupon discount: `(estimate?.total ?? cartTotal ?? 0) - (couponData?.discount_amount || 0)`.

---

### `app/components/AddToCart.js:37` — `variantName` never passed to guest cart
Guest cart constructs display name as `${productData.name} — ${productData.variantName ?? "Option"}`, but `AddToCart` never sends `variantName`. All guest carts display `"— Option"`.

**Fix:** Pass `variantName: selectedVariant?.name` in the `productData` object.

---

### `app/forgot-password/page.js:18` — Missing CSRF on password reset
Uses raw `fetch()` without `ensureCsrfToken()`. All other authenticated forms go through `authFetch` or call `ensureCsrfToken()`. The password reset is a security-sensitive operation.

**Fix:** Call `ensureCsrfToken()` before the reset fetch.

---

### `lib/cart.js:113` — No stock validation in guest cart
`addItem` for guests doesn't check `inStock` or `effectiveStock`. Only the `AddToCart` UI component gates the button — if `addItem` is called programmatically, out-of-stock items can be added.

**Fix:** Add stock validation inside `addItem` itself.

---

### `app/cart/page.js:133` — Coupon validation without CSRF
The coupon validation fetch does NOT use `ensureCsrfToken()`. Other authenticated fetches go through `authFetch` which handles CSRF.

**Fix:** Use `authFetch` or `ensureCsrfToken()` for coupon validation.

---

### Cross-cutting — No React Error Boundaries
No `error.js` or `error.tsx` files in route segments. If any component crashes (JSON parse error, malformed API response), the entire page whitescreens.

**Fix:** Add `error.js` files to key route segments and a global error boundary.

---

### Cross-cutting — Zero automated tests
No `*.test.js`, `*.spec.js`, or `__tests__` directories found. Zero unit tests, integration tests, or E2E tests for a payments-handling e-commerce application.

**Fix:** Add Vitest unit tests for lib/critical components + Playwright E2E for checkout flow.

---

### `lib/auth.js:70-75` — `tryRefresh` called on every 401 even without refresh token
When any `authFetch` gets a 401, `tryRefresh()` fires unconditionally. If the user has no valid refresh token (never logged in, token expired/revoked), this sends an unnecessary POST that will fail.

**Fix:** Check for a `has_refresh_token` cookie or flag before calling `tryRefresh()`.

---

### Admin pages — Pagination/filter state not in URL
All admin state (page number, search query) is in React `useState`, not the URL query string. Browser back button doesn't restore admin state. Sharing a filtered admin URL isn't possible. Refresh resets to page 1.

**Fix:** Use `useSearchParams` / `router.push` to sync state to the URL.

---

### `app/components/NewsletterForm.js:37` — Dead-code error logic
```js
if (!res.ok && res.status !== 201) { ... }
```
HTTP 201 is considered "ok" (2xx range), so the second condition can never be true. This is either dead code or a logical error — should likely be `res.status !== 400` for expected validation errors.

**Fix:** Correct the condition or remove the dead branch.

---

## Design / UX Gaps

### Cookie Consent (GDPR)
| Issue | Detail |
|-------|--------|
| No granular consent | Only binary Accept/Decline. GDPR requires separate consent for necessary, analytics, marketing, functional cookies. |
| No preference management | Once chosen, no way to change. No "Cookie Settings" link in footer. |
| No analytics consent events | No GA4 consent mode integration, no GTM `dataLayer.push`. Impossible to measure consent rates. |

### Cart UX
| Issue | Detail |
|-------|--------|
| No product thumbnails | Cart items are text-only — name, unit price, quantity, subtotal. No product images. Major UX gap. |
| No "Clear all filters" | Once filters are applied on the shop page, no one-click reset. Users must manually clear search and click "All". |
| Stale coupon display | If coupon is applied and cart items change, `couponData` shows stale discount amounts. Should invalidate on cart change. |
| Hardcoded min-height hack | `minHeight: "120px"` on estimate container is a layout hack for footer flicker — fragile. |

### Checkout
| Issue | Detail |
|-------|--------|
| No "Save address" | Users must re-enter their address on every purchase. |
| No payment method preview | Users are blindly redirected to Stripe with no card/UPI/PayPal selection preview. |
| Full page redirects | `window.location.href` for Stripe redirect loses React state and context. |
| No address autocomplete | No Google Places API or address validation beyond HTML `required`. |
| No phone field on shipping | Only name, email, address, city, state, zip. |
| Coupon logic duplicated | Identical coupon input, validation, and display code in both `cart/page.js` and `checkout/page.js`. |

### Auth Pages
| Issue | Detail |
|-------|--------|
| PasswordInput duplicated | `register/page.js` defines its own `PasswordInput` inline while `login/page.js` uses the shared component. |
| No password strength meter | Only basic regex validation (8 chars, uppercase, number). No zxcvbn or visual strength bar. |
| No email verification after registration | `register()` auto-logs in the user without a "check your email" step. |
| Unusual two-step registration | `first_name`/`last_name` in step 1, `username`/password in step 2. User abandons at step 2 = server never gets name data. |
| No "Remember me" on login | No session persistence option. |
| No "Resend" on forgot password | After reset email sent, no resend option if not received. |
| Misleading success message | "Check your inbox" shown even if email doesn't exist (good for security, bad for UX accuracy). |
| Raw backend error exposure | `setError(err.message)` passes raw error strings to UI without user-friendly mapping. |
| Phone validation too loose | Regex `/^[0-9+()\-\s]{7,20}$/` accepts `++++++++++`. |

### Wishlist
| Issue | Detail |
|-------|--------|
| No loading state during toggle | Rapid double-clicks cause add-then-remove race condition. |
| No optimistic UI update | Visual feedback delayed until server responds — noticeable on slow connections. |
| Type mismatch in comparison | `isWishlisted` uses `items.some(i => i.product === productId)` — API may return integer, URL param is string. `===` fails. |
| Guest merge uses sequential POSTs | Each wishlist item POSTed individually — slow for many items. |

### Image Handling
| Issue | Detail |
|-------|--------|
| Lightbox: no mobile swipe | Touch devices expect swipe left/right for navigation, swipe down to close. |
| Lightbox: no pinch-to-zoom | Standard mobile lightbox behavior missing. |
| Lightbox: no loading state | Large images show blank area while loading — no skeleton or blur-up. |
| Lightbox: uses raw `<img>` | Skips `next/image` entirely — no WebP conversion, no lazy loading, no responsive sizing. Disables ESLint rule. |
| ProductCard: no `sizes` prop | Images lack `sizes` attribute — suboptimal sizes served, potential CLS. |
| ProductCard: hardcoded badge colors | Raw hex values (`#e11d48`, `#2563eb`) ignore CSS custom properties and any future dark mode. |

### Empty / Error / Loading States
| Issue | Detail |
|-------|--------|
| No 404 page design | Unclear how missing routes render. |
| Cart empty state | Needs verification — standard e-commerce empty cart with CTA. |
| Orders empty state | New users see blank orders page — should show "No orders yet" with shop CTA. |
| Wishlist empty state | Same as above. |
| Admin stats fetch failure | `.catch(() => {})` silently swallows errors — stats skeleton shows indefinitely. |
| Product fetch failure | Raw error messages (`e.message`) exposed to UI — DNS errors or connection refused shown to users. |

### Navigation & Layout
| Issue | Detail |
|-------|--------|
| "Continue shopping" hardcoded | Always links to `/products`. Could use `router.back()`. |
| Auth hint cookies lack `Secure` flag | Only `samesite=lax` set — on HTTPS, should also be `Secure`. |
| No mobile bottom nav | Standard e-commerce pattern (Home, Search, Cart, Account) — only hamburger menu. |
| Scrollbars hidden globally | `scrollbar-width: none` on `*` — on desktop, long content has no scrollbar indicator. |

---

## Architecture / Technical Gaps

| Area | Gap |
|------|-----|
| **TypeScript** | Entire frontend is plain JS. No type safety on props, API responses, or context values. Runtime type mismatches occur (e.g., `isWishlisted` string vs integer). |
| **Analytics** | No GA4, GTM, or Facebook Pixel. Impossible to track conversion funnels, user behavior, or A/B tests. |
| **SEO** | No Schema.org JSON-LD on product pages, breadcrumbs, or shop page (only Organization on homepage). Static metadata on filtered product pages. |
| **i18n** | All strings hardcoded English. Currency hardcoded as `$`. No localization framework. |
| **PWA** | No service worker, no `manifest.json`, no install prompt, no offline caching. |
| **Server State** | No React Query / SWR. Each page makes independent fetch calls. No cache deduplication, no stale-while-revalidate. Product/category data fetched repeatedly. |
| **CSS Architecture** | Single monolithic `globals.css` (~5,000 lines). No CSS modules, no SCSS, no component-scoped styles. Global namespace — class name collisions possible as codebase grows. |
| **Code Duplication** | Coupon logic duplicated in cart + checkout. PasswordInput duplicated in register + login. Cart merge + wishlist merge share identical sequential-POST pattern. |
| **Performance** | No `priority` on first product images (LCP impact). Lightbox skips `next/image`. Reveal component causes flash-of-hidden-content for above-fold elements. `prefers-reduced-motion` has no subtle-fade alternative. |
| **Accessibility** | Lightbox missing focus trap. Admin tables lack `role`/`aria` attributes. Toast announcements not sent to screen readers (`aria-live` missing). |

---

## Quick Wins (High Impact, Low Effort)

1. Remove debug logs from `app/cart/page.js:58-105`
2. Add CSRF to forgot-password fetch
3. Pass `variantName` in `AddToCart` guest cart `productData`
4. Prepend `mainImage` into `images` array in `GalleryImages`
5. Add `[busy]` lock on `AddToCart` and `WishlistButton` to prevent rapid-click races
6. Extract shared `CouponInput` component from cart + checkout
7. Use shared `PasswordInput` in `register/page.js` instead of inline definition
8. Add `sizes` prop to `ProductCard` images (reduce CLS)
9. Fix coupon discount calculation in checkout when estimate is absent
10. Add stock validation inside `lib/cart.js` `addItem` for guests
11. Add product thumbnails to cart items
12. Add "Clear all filters" button to shop page
13. Add `priority` to first few product images on catalog page
14. Fix `NewsletterForm` dead-code error condition
15. Add `Secure` flag to auth hint cookies
16. Fix `isWishlisted` type comparison (use `==` or explicit `String()`/`Number()` conversion)
17. Add `error.js` boundaries to key route segments
18. Sync admin pagination/filter state to URL search params

---

## Severity Breakdown

| Category | Critical | High | Medium | Low | Cosmetic |
|----------|----------|------|--------|-----|----------|
| Components (10 files) | 0 | 4 | 9 | 12 | 5 |
| Auth Pages (5 files) | 0 | 3 | 7 | 10 | 0 |
| Library (4 files) | 1 | 1 | 8 | 8 | 1 |
| Admin/Products Pages | 0 | 1 | 5 | 6 | 1 |
| Cross-Cutting | 0 | 3 | 6 | 3 | 0 |

---

## Priority Roadmap

### Phase 1 — Critical Fixes (Week 1)
- Fix guest cart price manipulation (CART-01)
- Remove production debug logging (CRT-01)
- Fix `GalleryImages` main image discard (GI-01)
- Fix checkout coupon discount calculation (CHO-01)
- Pass `variantName` in guest cart (ATC-01)
- Add CSRF to forgot-password (FP-01)
- Add stock validation in guest cart (CART-02)

### Phase 2 — Stability (Week 2)
- Add React Error Boundaries (CC-02)
- Begin TypeScript migration (CC-01)
- Start test suite — critical paths (CC-03)
- Fix `tryRefresh` on every 401 (AUTH-01)
- Fix admin URL state persistence (ADM-01)

### Phase 3 — UX Polish (Week 3-4)
- Cookie consent granular controls (CC-01)
- Product thumbnails in cart (CRT-06)
- "Save address" on checkout (CHO-03)
- Address autocomplete (CHO-06)
- Password strength meter (REG-02)
- Lightbox mobile swipe/pinch (IL-02, IL-06)
- Clear all filters button (SF-02)
- Empty/error state improvements

### Phase 4 — Architecture (Ongoing)
- Code deduplication (coupon, password input, guest merge)
- React Query/SWR for server state
- Analytics integration (GA4 + consent mode)
- Schema.org structured data on products
- PWA support (service worker + manifest)
- i18n framework
- Component/scoped CSS migration
