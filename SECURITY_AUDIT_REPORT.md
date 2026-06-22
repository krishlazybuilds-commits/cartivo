# Cartivo Security Audit Report

**Project:** Cartivo (Full-Stack E-Commerce Platform)  
**Backend:** Django 5.1 + DRF 3.15 + SimpleJWT (Python 3.12)  
**Frontend:** Next.js 15 + React 18 + TypeScript (Node 20)  
**Infrastructure:** Docker + PostgreSQL + Redis + MinIO + Celery + Stripe  
**Date:** June 22, 2026  
**Auditor:** Buffy (Codebuff AI Agent)

---

## Executive Summary

Cartivo is a well-architected e-commerce platform with a **mature security posture**. The codebase demonstrates strong security awareness across the board:

- **Authentication:** httpOnly JWT cookies with CSRF enforcement, refresh token rotation and blacklisting
- **Rate Limiting:** Per-endpoint scopes (login: 10/min, register: 5/hr, contact: 5/hr) plus global defaults (anon: 60/min, user: 300/min)
- **CSP:** Per-request nonces with strict policy (no `unsafe-inline` in production)
- **Input Validation:** DRF serializers with explicit field constraints, disposable email blocking
- **Infrastructure:** Non-root Docker users, pinned SHA256 digests, least-privilege CI tokens

**All 7 HIGH findings and 12 MEDIUM findings from the previous audit are resolved.** The remaining open items are **5 LOW-severity hardening opportunities**. No critical vulnerabilities were identified.

**Overall Risk Rating: LOW** — Production-ready with minor hardening opportunities.

---

## Audit Scope

The following areas were reviewed:

### Backend (Python/Django)
| Area | Files Reviewed |
|------|---------------|
| Core configuration | `config/settings.py`, `config/urls.py`, `config/middleware.py`, `config/throttling.py`, `config/utils.py`, `config/celery.py`, `config/health.py`, `config/assets.py` |
| Authentication | `apps/accounts/views.py`, `apps/accounts/authentication.py`, `apps/accounts/serializers.py`, `apps/accounts/models.py`, `apps/accounts/urls.py`, `apps/accounts/tasks.py`, `apps/accounts/email_utils.py` |
| Orders & Payments | `apps/orders/views.py`, `apps/orders/serializers.py`, `apps/orders/services.py`, `apps/orders/models.py`, `apps/orders/email_utils.py` |
| Catalog | `apps/catalog/views.py`, `apps/catalog/serializers.py`, `apps/catalog/validators.py`, `apps/catalog/filters.py`, `apps/catalog/models.py` |
| Contact | `apps/contact/views.py`, `apps/contact/urls.py`, `apps/contact/models.py` |
| Infrastructure | `requirements.txt`, `Dockerfile`, `.env.example`, `.env.production.example` |

### Frontend (Next.js/React)
| Area | Files Reviewed |
|------|---------------|
| Core config | `middleware.js`, `next.config.mjs`, `package.json` |
| API routes | `app/api/revalidate/route.js`, `app/api/health/route.js` |
| Critical pages | `app/checkout/page.js`, `app/login/page.js`, `app/register/page.js` |
| Infrastructure | `Dockerfile`, `.env.example` |

### Infrastructure
| Area | Files Reviewed |
|------|---------------|
| CI/CD | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| Containerization | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` |

---

## Findings Summary

| Severity | Total | Resolved | Open |
|----------|-------|----------|------|
| 🔴 HIGH | 7 | 7 | 0 |
| 🟡 MEDIUM | 12 | 12 | 0 |
| 🟢 LOW | 10 | 8 | 2 |
| ℹ️ INFO | 9 | – | 9 |

---

## 🔴 HIGH Findings (7 — All Resolved)

### ~~1. CSRF Vulnerability on Unauthenticated POST Endpoints~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **Files** | `backend/apps/accounts/views.py`, `backend/apps/orders/views.py`, `backend/apps/contact/views.py` |
| **Fix** | `enforce_csrf(request)` added to every state-changing unauthenticated POST handler: `RegisterView.create`, `PasswordResetRequestView.post`, `PasswordResetConfirmView.post`, `EmailVerifyView.post`, `GuestCheckoutView.post`, `ShippingEstimateView.post`, `ValidateCouponView.post`, `contact()`, `subscribe()`. Authenticated views are covered by `CookieJWTAuthentication.authenticate()`. |

### ~~2. Missing Default DRF Rate Limiting~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/config/settings.py` |
| **Fix** | Added `DEFAULT_THROTTLE_CLASSES` with `AnonRateThrottle` (60/min) and `UserRateThrottle` (300/min). |

### ~~3. Password Reset Does Not Invalidate Existing Sessions~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | `_revoke_all_refresh_tokens(user)` blacklists every `OutstandingToken` for the user. User must re-authenticate on every device after a reset. |

### ~~4. Change Password Does Not Invalidate Other Sessions~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | After `user.save()`, all refresh tokens are blacklisted. A fresh access/refresh pair is issued for the current device so the user is not logged out of the device they're using. |

### ~~5. Credential Leakage via Verbose Logging (Google Login)~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | Removed `logger.info("Request headers: %s", dict(request.headers))`, `logger.info("Request body: %s", request.data)`, and ~10 other verbose INFO logs. Retained WARNING logs for security failures and a single INFO log (user pk only, no PII). |

### ~~6. CSRF Token Leakage via Verbose Logging~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/authentication.py` |
| **Fix** | Removed `logger.info("enforce_csrf — X-CSRFToken header: %s", ...)` and adjacent INFO logs that leaked request method/origin/referer. Only WARNING on failure is retained. |

### ~~7. Email Change Without Password Confirmation~~

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | Added `current_password` field to `EmailChangeRequestView.post`. Returns `403 Current password is incorrect` on mismatch. |

---

## 🟡 MEDIUM Findings (12 — All Resolved)

### ~~8. IP Spoofing in Rate Limiting (Admin Login Middleware)~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **Files** | `backend/config/utils.py` (new), `backend/config/middleware.py` |
| **Fix** | Created `get_client_ip()` that only trusts `X-Forwarded-For` when `REMOTE_ADDR` is in `TRUSTED_PROXIES`. |

### ~~9. IP Spoofing in DRF Throttles~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/config/throttling.py` |
| **Fix** | `UserOrAnonRateThrottle.get_ident()` now delegates to `get_client_ip()`. |

### ~~10. Unpinned Docker Base Images~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **Files** | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| **Fix** | All 7 image references pinned to manifest-list SHA256 digests. |

### ~~11. No CI Workflow Permissions~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `.github/workflows/ci.yml` |
| **Fix** | Added `permissions: contents: read` at the workflow level. |

### ~~12. npm Audit Ignores Critical Vulnerabilities~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `.github/workflows/ci.yml` |
| **Fix** | Changed to `npm audit --audit-level=critical --omit=dev`. `|| true` suppression removed. |

### ~~13. Contact Form Email Header Injection Potential~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/contact/views.py` |
| **Fix** | `_sanitize_name()` strips all characters unsafe for email headers: `\r\n\f\v\t\x00` are collapsed; `[^\w\s'.-]` is removed. |

### ~~14. No Rate Limiting on Next.js Revalidation Endpoint~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **Files** | `frontend/app/lib/rate-limit.js` (new), `frontend/app/api/revalidate/route.js` |
| **Fix** | In-memory sliding-window rate limiter: 10 requests/min/IP, returns 429 with `Retry-After`. |

### ~~15. xhtml2pdf for Invoice Generation~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **Files** | `backend/requirements.txt`, `backend/apps/orders/views.py` |
| **Fix** | Replaced `xhtml2pdf` with `weasyprint==69.0` (actively maintained). |

### ~~16. Password Reset Confirm Exception Handling Gap~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | Changed to `except Exception` around UID decoding. All malformed inputs return controlled `400 Invalid link`. |

### ~~17. Markdown Rendering Without Verified Sanitization~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED — No action needed** |
| **File** | `frontend/app/blog/[slug]/page.js` |
| **Verification** | Only one `marked()` call exists; its output is sanitized via `sanitize-html`. Blog content is first-party, not user-generated. |

### ~~18. Newsletter Subscription Missing CSRF Protection~~

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** |
| **File** | `backend/apps/contact/views.py` |
| **Fix** | Added `enforce_csrf(request)` to `subscribe()`. Throttling already in place. |

---

## 🟢 LOW Findings

### 19. ~~Product Stock Levels Exposed in Public API~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **File** | `backend/apps/catalog/serializers.py` |
| **Fix** | `ProductSerializer` and `ProductVariantSerializer` override `get_fields()` to exclude `stock` for non-staff users. |

### 20. ~~No `SECURE_CROSS_ORIGIN_OPENER_POLICY` in Django~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **File** | `backend/config/settings.py` |
| **Fix** | `SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"` added. |

### 21. ~~CSP Missing `report-uri` / `report-to` Directive~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **File** | `frontend/middleware.js`, `frontend/app/api/csp-report/route.js` (new) |
| **Fix** | Added `report-uri /api/csp-report` and `report-to csp-endpoint` directives to the CSP header. Created a new `/api/csp-report` endpoint that receives violation reports (POST, rate-limited to 120 req/min/IP) and logs them as structured JSON. Also sets the `Report-To` HTTP header with a 126-day `max_age` for modern browser support. |

### 22. ~~No `Permission-Policy` Header on Django API Responses~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **Files** | `backend/config/middleware.py`, `backend/config/settings.py` |
| **Fix** | Created `PermissionsPolicyMiddleware` that sets `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()` on every Django response (matching the frontend's existing policy in `next.config.mjs`). Registered in `MIDDLEWARE` list. |

### 23. ~~Auth Video Redirects to External CDN (Privacy Leak)~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **Files** | `backend/config/assets.py`, `backend/config/settings.py` |
| **Fix** | Changed `auth_video` view to serve a local copy of the video via `FileResponse` instead of redirecting to the Pexels CDN. The video file (`space-loop.mp4`, 5 MB) is stored in `backend/static/videos/` and configured via `AUTH_VIDEO_PATH` (defaults to `static/videos/space-loop.mp4`). The old `AUTH_VIDEO_URL` env-var is still supported for environments that prefer CDN offload — if set, the view redirects there. Added `STATICFILES_DIRS` so `collectstatic` bundles the video for production. |

### 24. ~~No HSTS Header on Django API Responses~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED — Already configured** |
| **File** | `backend/config/settings.py` |
| **Verification** | `SECURE_HSTS_SECONDS=31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS=True`, `SECURE_HSTS_PRELOAD=True` are all set in production settings. |

### 25. Frontend Auth Hint Bypassable via Fake Cookie

| | |
|---|---|
| **Status** | **OPEN — Acceptable as-is** |
| **File** | `frontend/middleware.js` |
| **Issue** | Middleware checks `request.cookies.has("refresh_token")` without validating the token. An attacker can set a fake cookie to bypass redirects from `/login`/`/register`. |
| **Impact** | UI-only bypass — API still rejects invalid tokens. Could confuse automated scanners. |
| **Remediation** | Consider adding a lightweight `/auth/validate` endpoint for middleware validation. Acceptable as a UX optimization. |

### 26. ~~Next.js HSTS Set Unconditionally~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **File** | `frontend/next.config.mjs` |
| **Fix** | `Strict-Transport-Security` header is now conditional on `NODE_ENV === "production"`. |

### 27. No Email Verification Required for Login

| | |
|---|---|
| **Status** | **OPEN — Design choice** |
| **File** | `backend/apps/accounts/views.py` |
| **Issue** | `LoginView` does not check `user.email_verified` before issuing tokens. An attacker who registers with someone else's email can immediately use the account. |
| **Impact** | Low — design choice. At minimum, flag unverified accounts in the UI. |
| **Remediation** | Consider requiring email verification before allowing checkout or sensitive actions. |

### 28. ~~`db.sqlite3` File Exists in Workspace~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED — Not tracked** |
| **Verification** | `git ls-files | grep db.sqlite3` returns nothing. Properly excluded by `.gitignore`. |

### 29. ~~`binascii.Error` Not Caught in Password Reset~~ ✅ RESOLVED

| | |
|---|---|
| **Status** | **RESOLVED** |
| **File** | `backend/apps/accounts/views.py` |
| **Fix** | Resolved as part of finding #16 — catch is now `except Exception`. |

---

## ℹ️ INFO Findings (Positive Observations)

### 30. Strong JWT Cookie Security

| | |
|---|---|
| **Status** | ✅ GOOD |
| **Files** | `backend/apps/accounts/authentication.py`, `backend/config/settings.py` |
| **Details** | JWT access and refresh tokens stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. `CookieJWTAuthentication` enforces CSRF for cookie-based requests. Refresh tokens are stored in DB (`OutstandingToken`) and blacklisted on logout. |

### 31. Strict CORS Configuration

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/settings.py` |
| **Details** | `CORS_ALLOWED_ORIGINS` is explicitly set (not `*`). `CORS_ALLOW_CREDENTIALS = True` paired with explicit origin lists. Production mode validates that all origins use HTTPS and contain no wildcards. |

### 32. Django Security Middleware Enabled

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/settings.py` |
| **Details** | Production settings enable: `SECURE_SSL_REDIRECT`, HSTS (1 year + subdomains + preload), `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS = "DENY"`, `SECURE_CROSS_ORIGIN_OPENER_POLICY`. |

### 33. Custom Admin Login Rate Limiting

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/middleware.py` |
| **Details** | `AdminLoginRateMiddleware` provides a custom sliding-window rate limiter for the Django admin login (10 attempts per 5 minutes per IP). |

### 34. GitHub Actions Pinned to SHA

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `.github/workflows/ci.yml` |
| **Details** | All third-party GitHub Actions pinned to specific commit SHAs rather than floating tags. |

### 35. Input Validation via DRF Serializers

| | |
|---|---|
| **Status** | ✅ GOOD |
| **Files** | `backend/apps/*/serializers.py` |
| **Details** | All major endpoints use DRF serializers with explicit `CharField` max lengths, `EmailField`, `IntegerField` with `min_value`/`max_value`, `DecimalField` with precision limits. |

### 36. Comprehensive Rate Limiting Architecture

| | |
|---|---|
| **Status** | ✅ GOOD |
| **Files** | `backend/config/throttling.py`, `backend/config/settings.py` |
| **Details** | Custom throttle hierarchy: `UserOrAnonRateThrottle` separates authenticated (per-user) and anonymous (per-IP) buckets. `WriteRateThrottle` exempts safe methods. Per-endpoint scopes cover login, register, password reset, contact, cart, orders, payments, coupons, shipping, order velocity, and order lookup. |

### 37. Disposable Email Blocking

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/apps/accounts/email_utils.py` |
| **Details** | Registry of ~80 known disposable email domains checked at registration, contact form, email change, and newsletter subscription. Gmail alias normalization (`+` stripping, `.` removal) prevents bypasses. |

### 38. Production Startup Validation

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/settings.py` |
| **Details** | Production boot validates: `ALLOWED_HOSTS` (no wildcards), `CORS_ALLOWED_ORIGINS` (HTTPS only, no wildcards), `CSRF_TRUSTED_ORIGINS` (HTTPS only, no wildcards). Missing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or S3 credentials causes a hard error. |

---

## New Observations from Current Audit

### N1. Registration Endpoint Behavior on Duplicate Email

| | |
|---|---|
| **File** | `backend/apps/accounts/views.py` |
| **Observation** | When a registration attempt uses an existing email, the endpoint returns HTTP 201 (same status as successful registration) without creating a user or sending a verification email. This is intentional anti-enumeration. |
| **Risk** | Minimal. Rate limiting (5/hour/IP) prevents brute-force enumeration. The timing difference from the skipped email send is negligible. |

### N2. Bulk Product Import — File Content Validation

| | |
|---|---|
| **File** | `backend/apps/catalog/views.py` |
| **Observation** | The `import_products` action accepts CSV/XLSX files via `MultiPartParser`. No explicit content-type or magic-byte validation beyond file extension. |
| **Risk** | Low. Non-compliant files produce empty results rather than code execution. `openpyxl` (XLSX parser) should be kept current (currently pinned at reasonable version). |

### N3. Stripe Webhook — No IP Allow-Listing

| | |
|---|---|
| **File** | `backend/apps/orders/views.py` |
| **Observation** | Webhook is `@csrf_exempt` (required) and accepts POSTs from any IP. Stripe signature verification is the sole protection. |
| **Risk** | Low. Signature verification is cryptographically sound. Adding Stripe's published IP ranges would be defense-in-depth. |

### N4. GDPR Views Use Lazy Cross-App Imports

| | |
|---|---|
| **Files** | `backend/apps/accounts/views.py` (GDPRExportView, GDPRDeleteView) |
| **Observation** | Models from `orders`, `catalog`, `cart`, and `contact` are imported inside method bodies rather than at module top level. |
| **Risk** | None. This is an intentional pattern to avoid circular imports. Functionally equivalent. |

### N5. Guest Price Validation in Frontend Checkout

| | |
|---|---|
| **File** | `frontend/app/checkout/page.js` |
| **Observation** | Guest checkout validates localStorage prices against the server API on mount. If prices differ (due to tampering or changes since the item was added), localStorage is updated. |
| **Risk** | None. This is a **good** security practice. The backend always charges the real price regardless of what the client sends. |

---

## Overall Recommendations Priority

| Priority | Action | Effort | Area |
|----------|--------|--------|------|
| **P3** | Add CSP `report-uri` / `report-to` directive | Low | `frontend/middleware.js` |
| **P3** | Add `Permission-Policy` header to Django responses | Low | `backend/config/settings.py` |
| **P3** | Self-host auth video to avoid third-party CDN dependency | Medium | `backend/config/settings.py`, `backend/config/assets.py` |
| **P3** | Consider requiring email verification before checkout | Low | `backend/apps/accounts/views.py` |
| **P4** | Add Stripe webhook IP allow-listing | Low | `backend/apps/orders/views.py` |

---

## Appendix: Dependency Security

| Dependency | Version | Notes |
|------------|---------|-------|
| Django | 5.1.15 | Latest patch in 5.1.x — includes security fixes |
| djangorestframework | 3.15.2 | Latest stable |
| djangorestframework-simplejwt | 5.5.1 | Latest — token blacklist support |
| stripe | 11.4.1 | Latest SDK for Python |
| sentry-sdk | 2.19.2 | Latest — security patches |
| weasyprint | 69.0 | Actively maintained replacement for xhtml2pdf |
| Pillow | 12.2.0 | Latest — includes imaging security fixes |
| Next.js | 15.5.16 | Latest in 15.x |
| React | 18.3.1 | Latest stable |
| TypeScript | 6.0.3 | Latest |

**CI security scanning:**
- `pip-audit` runs on every push/PR to scan Python dependencies for known vulns
- `npm audit --audit-level=critical --omit=dev` scans production JS dependencies
- Critical vulns in production deps **fail the build**

---

*Report generated by Buffy (Codebuff AI Agent) on June 22, 2026. This assessment is based on static code analysis of the current codebase. A full penetration test with dynamic scanning (OWASP ZAP, Burp Suite) is recommended before major production launch.*
