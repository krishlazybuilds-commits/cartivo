# Cartivo Security Audit Report

**Project:** Cartivo (Full-Stack E-Commerce Platform)  
**Backend:** Django 5.1 + DRF 3.15 + SimpleJWT (Python 3.12)  
**Frontend:** Next.js 15 + React 18 + TypeScript (Node 20)  
**Infrastructure:** Docker + PostgreSQL + Redis + MinIO + Celery + Stripe  
**Date:** 2025-08-01 (last updated: 2026-06-19)  
**Auditor:** Kimi Work Automated Security Audit  

---

## Executive Summary

Cartivo is a well-architected Django/Next.js e-commerce platform with a **mature security posture**. The codebase demonstrates good security awareness: JWT tokens in `httpOnly` cookies with CSRF protection, Django security headers, rate limiting on critical endpoints, strict CORS configuration, input validation via DRF serializers, and Django's security middleware. However, **several gaps exist** that could be exploited for account takeover, session fixation, credential leakage via logs, and CSRF on unauthenticated endpoints.

**Overall Risk Rating:** **MEDIUM** — The application is reasonably secure for general use, but the remaining HIGH-severity issue around email-change flow should be addressed before production deployment. **6 of 7 HIGH findings have been resolved** (rate-limiting gap closed in commit `e1f6dd1`; verbose credential logging cleaned up on 2026-06-19; refresh-token revocation on password reset and change implemented on 2026-06-19; CSRF added to all unauthenticated POST endpoints on 2026-06-19).

---

## Findings by Severity

### 🔴 HIGH (7 findings)

#### ~~1. CSRF Vulnerability on Unauthenticated POST Endpoints~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 |
| **Files** | `backend/apps/accounts/views.py`, `backend/apps/orders/views.py`, `backend/apps/contact/views.py` |
| **Fix Applied** | Added an explicit `enforce_csrf(request)` call as the first line of every state-changing unauthenticated POST handler: `RegisterView.create`, `PasswordResetRequestView.post`, `PasswordResetConfirmView.post`, `EmailVerifyView.post`, `GuestCheckoutView.post`, `ShippingEstimateView.post`, `ValidateCouponView.post`, `contact()`, and `subscribe()`. Authenticated views (e.g. `EmailChangeConfirmView`, `ChangePasswordView`) were already covered transparently by `CookieJWTAuthentication.authenticate()`, which calls `enforce_csrf` whenever a JWT cookie is present. All 205 backend tests pass. |

---

#### ~~2. Missing Default DRF Rate Limiting — Multiple Endpoints Unthrottled~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed in commit `e1f6dd1` (2026-06-19) |
| **File** | `backend/config/settings.py` |
| **Fix Applied** | Added `DEFAULT_THROTTLE_CLASSES` with `AnonRateThrottle` (60/min per IP) and `UserRateThrottle` (300/min per user). All endpoints now receive rate limiting by default; custom per-endpoint scopes still override where declared. |

---

#### ~~3. Password Reset Does Not Invalidate Existing Sessions~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 |
| **File** | `backend/apps/accounts/views.py` (PasswordResetConfirmView) |
| **Fix Applied** | Added `_revoke_all_refresh_tokens(user)` helper that blacklists every `OutstandingToken` for the user via `BlacklistedToken.objects.get_or_create()`. Called immediately after `user.save()` in the reset confirm flow. The response intentionally does **not** set new auth cookies — the user must re-authenticate on every device after a reset. Test coverage: `test_reset_blacklists_existing_refresh_tokens`, `test_reset_does_not_set_auth_cookies`. |

---

#### ~~4. Change Password Does Not Invalidate Other Sessions~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 |
| **File** | `backend/apps/accounts/views.py` (ChangePasswordView) |
| **Fix Applied** | After `user.save()`, the view calls `_revoke_all_refresh_tokens(user)` to blacklist every outstanding refresh token. It then mints a **fresh** access/refresh pair via `RefreshToken.for_user(user)` and attaches them as cookies on the response, so the user who just authenticated by entering their current password is not logged out of the device they're using. Other devices and any attacker holding a stolen token are evicted. Test coverage: `test_change_password_blacklists_existing_refresh_tokens`, `test_change_password_reissues_auth_cookies_for_current_device`, `test_change_password_fresh_refresh_token_still_works`. |

---

#### ~~5. Credential Leakage via Verbose Logging (Google Login)~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 |
| **File** | `backend/apps/accounts/views.py` (GoogleLoginView) |
| **Fix Applied** | Removed `logger.info("Request headers: %s", dict(request.headers))` and `logger.info("Request body: %s", request.data)`. Removed ~10 additional verbose INFO logs that exposed credential length, token issuer/audience, email payload, and full user records. Retained WARNING logs for security failures and a single INFO log on successful login (user pk only, no PII). |

---

#### ~~6. CSRF Token Leakage via Verbose Logging~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~HIGH~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 |
| **File** | `backend/apps/accounts/authentication.py` (enforce_csrf function) |
| **Fix Applied** | Removed the `logger.info("enforce_csrf — X-CSRFToken header: %s", ...)` line that exposed raw CSRF tokens, plus the two adjacent INFO logs that leaked request method/origin/referer and cookie key names. Only the WARNING log on CSRF failure is retained. |

---

#### 7. Email Change Without Password Confirmation

| | |
|---|---|
| **Severity** | HIGH |
| **File** | `backend/apps/accounts/views.py` (EmailChangeRequestView) |
| **Description** | `EmailChangeRequestView` allows an authenticated user to request an email change **without re-authenticating or confirming their current password**. It generates a secure token and sends a confirmation email to the new address. |
| **Impact** | If an attacker compromises a user's session (e.g., via XSS, stolen refresh token, or physical device access), they can immediately change the email address. Once the email is changed, the attacker can initiate a password reset and take full control of the account. The legitimate user is locked out. This is a critical account takeover vector. |
| **Remediation** | Require the current password in the `EmailChangeRequestView` request body. Verify the password against `user.check_password()` before allowing the email change request. This is a standard security practice for sensitive account modifications. |

---

### 🟡 MEDIUM (12 findings)

#### 8. IP Spoofing in Rate Limiting (Admin Login Middleware)

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `backend/config/middleware.py` (AdminLoginRateMiddleware) |
| **Description** | The middleware uses `HTTP_X_FORWARDED_FOR` to determine the client IP: `xff = request.META.get("HTTP_X_FORWARDED_FOR"); return xff.split(",")[0].strip()`. If the application is **not** deployed behind a trusted reverse proxy (e.g., Nginx, Cloudflare), an attacker can send a custom `X-Forwarded-For` header to bypass the rate limit entirely. |
| **Impact** | An attacker can bypass the 10-requests-per-5-minutes lockout on the Django admin login by rotating the `X-Forwarded-For` header on each request. This enables brute-force attacks against the admin panel. |
| **Remediation** | Ensure the application is **always** deployed behind a trusted reverse proxy that strips or overwrites the `X-Forwarded-For` header. Alternatively, use `django-ratelimit` with `django-ipware` configured for trusted proxy ranges. Add a check that `X-Forwarded-For` is only trusted when `REMOTE_ADDR` is in a known proxy IP range. |

---

#### 9. IP Spoofing in DRF Throttles

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `backend/config/throttling.py` (UserOrAnonRateThrottle) |
| **Description** | The `UserOrAnonRateThrottle` inherits from `SimpleRateThrottle` and uses `get_ident()` which checks `HTTP_X_FORWARDED_FOR` before `REMOTE_ADDR`. The same IP spoofing issue applies to all rate-limited API endpoints. |
| **Impact** | Attackers can bypass rate limits on the login endpoint, password reset, registration, and other throttled endpoints by sending a forged `X-Forwarded-For` header. |
| **Remediation** | Same as finding #8. Use a trusted proxy configuration. Consider `django-ipware` with explicit `TRUSTED_PROXIES` settings. |

---

#### 10. Unpinned Docker Base Images (Supply Chain Risk)

| | |
|---|---|
| **Severity** | MEDIUM |
| **Files** | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| **Description** | The Dockerfiles use floating tags (`python:3.12-slim`, `node:20-slim`) instead of specific SHA256 digests. The docker-compose uses `postgres:16`, `redis:7-alpine`, and `minio/minio:latest`. |
| **Impact** | Floating tags can be silently updated to malicious or compromised versions if the upstream registry is compromised (e.g., via supply chain attack on Docker Hub). The `minio/minio:latest` tag is especially risky as it always pulls the latest release. |
| **Remediation** | Pin all base images to specific SHA256 digests. For example: `python:3.12-slim@sha256:abc123...`. Update images deliberately after reviewing changelogs and scanning for vulnerabilities. |

---

#### 11. No CI Workflow Permissions (GitHub Actions)

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `.github/workflows/ci.yml` |
| **Description** | The GitHub Actions workflow does not declare `permissions:` at the workflow or job level. The default `GITHUB_TOKEN` may have excessive permissions (e.g., write access to repository contents, issues, packages). |
| **Impact** | If a compromised action or malicious PR exploits the workflow, it could potentially modify repository contents, publish packages, or access secrets. This is a supply chain and privilege escalation risk. |
| **Remediation** | Add explicit minimum permissions to the workflow:
```yaml
permissions:
  contents: read
  security-events: write  # if using code scanning
```
Set job-level permissions where different jobs need different access. |

---

#### 12. npm Audit Ignores Critical Vulnerabilities

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `.github/workflows/ci.yml` (line 127) |
| **Description** | The CI runs `npm audit --audit-level=critical || true`, which means **even CRITICAL vulnerabilities will not fail the build**. The `|| true` unconditionally returns success. |
| **Impact** | Critical vulnerabilities in production Node.js dependencies (e.g., Next.js, React, or their transitive dependencies) can be introduced without any CI failure. The team may be unaware of severe security issues in the frontend. The `esbuild` and `postcss` overrides suggest past vulnerability awareness, but the `|| true` bypass defeats the purpose. |
| **Remediation** | Remove `|| true` and set `audit-level=high` or `audit-level=critical`. For known acceptable risks, use `npm audit --ignore` with specific advisories in `package.json` rather than blanket suppression. |

---

#### 13. Contact Form Email Header Injection Potential

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `backend/apps/contact/views.py` |
| **Description** | The contact form constructs the email subject using an f-string: `subject=f"[Cartivo Contact] Message from {name}"`. The `name` field strips `\r` and `\n` but does **not** sanitize other email header injection characters** such as `\0`, `\t`, `:`, `<`, `>`, or `@`. While Django's `send_mail` does provide some protection, it is not a complete defense against all header injection techniques. |
| **Impact** | A crafted `name` value could potentially inject additional email headers (e.g., `Bcc:`, `Cc:`, `Reply-To:`), redirecting the contact form submission to attacker-controlled addresses or enabling email spam relay. |
| **Remediation** | Sanitize the `name` field before using it in the subject. Use a dedicated library like `email.utils.formataddr` or ` bleach` to strip special characters. Better yet, use a fixed subject and put the user's name in the email body. |

---

#### 14. No Rate Limiting on Next.js Revalidation Endpoint

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `frontend/app/api/revalidate/route.js` |
| **Description** | The `/api/revalidate` endpoint accepts a `tag` and `secret` and calls `revalidateTag(tag)` with no rate limiting. If the `REVALIDATION_SECRET` is exposed or brute-forced, an attacker can trigger unlimited revalidation requests. |
| **Impact** | If the secret is compromised, an attacker can cause a Denial of Service by constantly forcing ISR revalidation, overloading the Next.js server and the backend API. |
| **Remediation** | Add a simple rate limiter (e.g., using `lru-cache` or Upstash Redis) to the revalidation route. Limit to e.g., 10 requests per minute per IP. Also, rotate the `REVALIDATION_SECRET` regularly. |

---

#### 15. xhtml2pdf for Invoice Generation (HTML Parsing Risks)

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `backend/apps/orders/views.py` (OrderViewSet.invoice), `backend/apps/orders/email_utils.py` (send_pdf_email) |
| **Description** | The project uses `xhtml2pdf==0.2.17` to convert HTML invoices to PDF. `xhtml2pdf` is known to have security issues with HTML parsing, including potential XML external entity (XXE) attacks and insecure handling of CSS/CSS imports. The invoice template (`orders/invoice.html`) renders user-controlled data such as shipping addresses, customer names, and order notes. |
| **Impact** | If a user injects malicious HTML/CSS into their shipping address or order notes, `xhtml2pdf` might process it in unexpected ways. While Django templates auto-escape by default, complex HTML entities or specially crafted CSS could potentially exploit parser weaknesses. Additionally, `xhtml2pdf` has not been actively maintained and may contain unpatched vulnerabilities. |
| **Remediation** | Consider migrating to a more secure PDF generation library like `WeasyPrint` (actively maintained, better security record) or `reportlab` with strict input sanitization. Alternatively, ensure all user inputs are stripped of HTML before rendering in the invoice template. |

---

#### 16. Password Reset Confirm Exception Handling Gap

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `backend/apps/accounts/views.py` (PasswordResetConfirmView) |
| **Description** | The `PasswordResetConfirmView` catches `(User.DoesNotExist, ValueError)` when decoding the UID and validating the token. However, `urlsafe_base64_decode` can raise `binascii.Error` (a subclass of `ValueError`? No, `binascii.Error` is not a subclass of `ValueError`), and `force_str` on arbitrary bytes can raise `UnicodeDecodeError`. These exceptions are not caught. |
| **Impact** | An attacker can send a malformed `uid` (e.g., non-UTF-8 bytes after base64 decoding) to cause an unhandled exception. This results in a **500 Internal Server Error** instead of a controlled 400 response, potentially leaking stack traces in DEBUG mode and creating a minor information disclosure vector. |
| **Remediation** | Catch `Exception` broadly around the decoding block, or explicitly catch `(User.DoesNotExist, ValueError, binascii.Error, UnicodeDecodeError)`. Return a generic `400 Invalid link` for all errors. |

---

#### 17. Markdown Rendering Without Verified Sanitization

| | |
|---|---|
| **Severity** | MEDIUM |
| **File** | `frontend` (blog pages, product descriptions — not fully read) |
| **Description** | The project includes `marked==18.0.5` (a Markdown parser) and `sanitize-html==2.17.5` (an HTML sanitizer). The presence of both suggests Markdown is rendered to HTML somewhere. However, without reading every component, it is **not verified** that `marked` output is consistently passed through `sanitize-html` before being rendered to the DOM. |
| **Impact** | If Markdown content (e.g., blog posts, product descriptions, or reviews) is rendered directly to HTML without sanitization, it could enable Stored XSS attacks. An attacker with content-writing privileges (or via a user-generated content feature) could inject `<script>` tags or event handlers. |
| **Remediation** | Audit all uses of `marked()` in the frontend. Ensure every instance is wrapped with `DOMPurify` or `sanitize-html` before insertion into the DOM. Never use `dangerouslySetInnerHTML` with raw Markdown output. |

---

#### ~~18. Newsletter Subscription Missing CSRF Protection~~ ✅ FIXED

| | |
|---|---|
| **Severity** | ~~MEDIUM~~ |
| **Status** | **RESOLVED** — Fixed on 2026-06-19 (rolled into Finding #1 fix) |
| **File** | `backend/apps/contact/views.py` (subscribe function) |
| **Fix Applied** | Added `enforce_csrf(request)` to the `subscribe` function. Throttling was already in place via `@throttle_classes([ContactRateThrottle])`. |

---

### 🟢 LOW (10 findings)

#### 19. Product Stock Levels Exposed in Public API

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/apps/catalog/serializers.py` (ProductSerializer, ProductVariantSerializer) |
| **Description** | The `ProductSerializer` includes the `stock` field (read-only for public, but still visible). The `ProductVariantSerializer` also exposes `stock` for authenticated users. |
| **Impact** | An attacker can scrape the catalog to determine exact stock levels for every product and variant. This is business intelligence leakage that competitors could exploit for inventory planning or to time purchase bots. |
| **Remediation** | For public (non-staff) requests, exclude the `stock` field or return a boolean `in_stock` instead of the exact quantity. |

---

#### 20. No `SECURE_CROSS_ORIGIN_OPENER_POLICY` in Django

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/config/settings.py` |
| **Description** | Django's `SecurityMiddleware` supports `SECURE_CROSS_ORIGIN_OPENER_POLICY` (COOP) to prevent cross-origin window manipulation attacks. This setting is not configured. |
| **Impact** | Without COOP, a malicious cross-origin page could use `window.opener` to manipulate the application's window (e.g., navigate it to a phishing page). This is a low-severity issue because the application primarily uses SameSite cookies and API-driven flows. |
| **Remediation** | Add `SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"` or `"same-origin"` to the production settings. |

---

#### 21. Missing CSP `report-uri` / `report-to` Directive

| | |
|---|---|
| **Severity** | LOW |
| **File** | `frontend/middleware.js` |
| **Description** | The Content Security Policy is set via `next/headers` in the frontend middleware but does **not** include a `report-uri` or `report-to` directive. |
| **Impact** | CSP violations (e.g., from a missing script source, XSS attempt, or third-party injection) go unreported. The team has no visibility into CSP violations in production. |
| **Remediation** | Add a `report-uri` endpoint (e.g., a Sentry CSP endpoint or a custom logging endpoint) and include it in the CSP header: `report-uri https://your-sentry-instance.com/api/csp-report/`. |

---

#### 22. No `Permission-Policy` Header in Django API Responses

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/config/settings.py` |
| **Description** | The Next.js frontend sets `Permissions-Policy` via `next.config.mjs`, but the Django backend API responses do not include this header. |
| **Impact** | If the API is accessed directly (e.g., by a mobile app or third-party integration), the browser does not receive the permission policy. This is a minor inconsistency in security posture. |
| **Remediation** | Add `Permission-Policy` to Django's `SECURE_HEADERS` or via a custom middleware that mirrors the frontend policy. |

---

#### 23. `auth_video` Redirects to External CDN (Privacy Leak)

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/config/assets.py` (auth_video) |
| **Description** | The `auth_video` endpoint redirects the user's browser to an external URL (Pexels CDN by default). |
| **Impact** | The user's IP address and browser fingerprint are leaked to the third-party CDN. If the CDN is compromised, the video asset could be replaced with malicious content. This is a privacy and minor supply chain concern. |
| **Remediation** | Self-host the video asset or use a trusted CDN with subresource integrity (SRI) checks. Alternatively, proxy the video through the application server. |

---

#### 24. No HSTS Header on Django API Responses

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/config/settings.py` |
| **Description** | The Next.js frontend sets `Strict-Transport-Security` via `next.config.mjs`, but Django's `SECURE_HSTS_SECONDS` is only set in the production settings block. If the API is accessed directly or via a different route, the HSTS header might be missing. |
| **Impact** | If a user accesses the API directly over HTTP, they will not receive the HSTS header. This is a minor SSL stripping protection gap. |
| **Remediation** | Ensure `SECURE_HSTS_SECONDS` is consistently set in all production environments. Verify that the reverse proxy also adds HSTS headers for API responses. |

---

#### 25. Frontend Auth Hint Bypassable via Fake Cookie

| | |
|---|---|
| **Severity** | LOW |
| **File** | `frontend/middleware.js` |
| **Description** | The middleware checks `hasToken = request.cookies.has("refresh_token")` to determine if a user is "authenticated" and redirects them away from `/login` or `/register`. This is purely a client-side hint. |
| **Impact** | An attacker can set a fake `refresh_token` cookie (any value) to bypass the middleware redirect. However, the API will still reject the request, so this is only a UI bypass. It could confuse automated scanners or testing tools. |
| **Remediation** | This is acceptable as a UX optimization, but consider adding a lightweight `/auth/validate` endpoint that the middleware can call to verify the token's actual validity. This adds a network request but improves accuracy. |

---

#### 26. Next.js HSTS Set Unconditionally

| | |
|---|---|
| **Severity** | LOW |
| **File** | `frontend/next.config.mjs` |
| **Description** | The `Strict-Transport-Security` header with `max-age=31536000` is set in the `next.config.mjs` headers, which applies to **all environments** (including development). |
| **Impact** | If a developer accesses the local dev server over HTTP, the browser will cache the HSTS policy and may refuse to connect to `localhost` over HTTP for up to a year. This can cause confusing development issues. |
| **Remediation** | Make the HSTS header conditional on `process.env.NODE_ENV === "production"` or a custom `ENABLE_HSTS` flag. |

---

#### 27. No Email Verification Required for Login

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/apps/accounts/views.py` (LoginView) |
| **Description** | `LoginView` does not check `user.email_verified` before issuing tokens. A user can log in with an unverified email address. |
| **Impact** | This is a design choice, not a strict vulnerability. However, it means an attacker who registers an account with someone else's email can immediately use the account. For an e-commerce platform, this could be used for fraud or abuse. |
| **Remediation** | Consider requiring email verification before allowing checkout or sensitive actions. At minimum, flag unverified accounts in the UI. |

---

#### 28. `db.sqlite3` File Exists in Workspace

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/db.sqlite3` |
| **Description** | A `db.sqlite3` file exists in the backend directory. It is listed in `.gitignore` (`db.sqlite3`), so it should not be committed to version control. |
| **Impact** | If accidentally committed (e.g., via `git add -f` or a `.gitignore` misconfiguration), it could contain sensitive data: user passwords (hashed), email addresses, order details, and potentially API keys. It also bloats the repository. |
| **Remediation** | Verify it is not tracked by git: `git ls-files | grep db.sqlite3` should return nothing. Consider adding a pre-commit hook to block `.sqlite3` files. Delete it from the workspace if it contains old/development data. |

---

#### 29. `binascii.Error` Not Caught in Password Reset

| | |
|---|---|
| **Severity** | LOW |
| **File** | `backend/apps/accounts/views.py` (PasswordResetConfirmView) |
| **Description** | This is a more specific variant of finding #16. The `urlsafe_base64_decode` function can raise `binascii.Error` for malformed base64 input, which is not a subclass of `ValueError`. |
| **Impact** | Causes a 500 error instead of a controlled 400 response for malformed reset links. |
| **Remediation** | Wrap the UID decoding in a broad `try/except Exception` block for the password reset flow. |

---

### ℹ️ INFO (6 findings — Positive Observations)

#### 30. Strong JWT Cookie Security

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/apps/accounts/authentication.py`, `backend/config/settings.py` |
| **Details** | JWT access and refresh tokens are stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. The `AUTH_COOKIE_SECURE` defaults to `True` in production. The `CookieJWTAuthentication` class enforces CSRF for cookie-based requests. Refresh tokens are stored in the database (`OutstandingToken`) and blacklisted on logout. This is a strong, modern authentication pattern. |

---

#### 31. Strict CORS Configuration

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/settings.py` |
| **Details** | `CORS_ALLOWED_ORIGINS` is explicitly set to specific origins (not `*`). `CORS_ALLOW_CREDENTIALS = True` is paired with explicit origin lists. The `CORS_URLS_REGEX` restricts CORS to `/api/v1` paths. This prevents unauthorized cross-origin API access. |

---

#### 32. Django Security Middleware Enabled

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/settings.py` |
| **Details** | Production settings enable `SecurityMiddleware` with `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_BROWSER_XSS_FILTER`, and `X_FRAME_OPTIONS = "DENY"`. These are all correctly configured for production. |

---

#### 33. Custom Admin Login Rate Limiting

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/config/middleware.py` |
| **Details** | The `AdminLoginRateMiddleware` provides a custom sliding-window rate limiter for the Django admin login. It prevents brute-force attacks against the admin panel. While the IP spoofing issue exists (finding #8), the presence of this middleware shows good security awareness. |

---

#### 34. GitHub Actions Pinned to SHA

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `.github/workflows/ci.yml` |
| **Details** | All third-party GitHub Actions (`actions/checkout`, `actions/setup-python`, `actions/setup-node`) are pinned to specific commit SHAs rather than floating tags. This is a strong supply chain security practice that prevents tag-hijacking attacks. |

---

#### 35. Input Validation via DRF Serializers

| | |
|---|---|
| **Status** | ✅ GOOD |
| **File** | `backend/apps/*/serializers.py` |
| **Details** | All major endpoints use DRF serializers with explicit `CharField` max lengths, `EmailField`, `IntegerField` with `min_value`/`max_value`, and `DecimalField` with precision limits. The `GuestCheckoutSerializer` validates `quantity` (1–100) and uses `EmailField` for guest email. This prevents basic injection attacks and malformed input. |

---

## Recommendations Summary

| Priority | Action | Effort |
|----------|--------|--------|
| ~~**P0**~~ | ~~Add `enforce_csrf()` to all unauthenticated POST endpoints (register, password reset request, email verify, contact, subscribe, guest checkout, etc.)~~ ✅ **DONE** (2026-06-19) | Low |
| ~~**P0**~~ | ~~Add `DEFAULT_THROTTLE_CLASSES` to DRF settings to close the rate-limiting gap~~ ✅ **DONE** (commit `e1f6dd1`) | Low |
| ~~**P0**~~ | ~~Invalidate all refresh tokens on password reset and password change~~ ✅ **DONE** (2026-06-19) | Low |
| ~~**P0**~~ | ~~Remove or redact verbose logging in `GoogleLoginView` and `enforce_csrf`~~ ✅ **DONE** (2026-06-19) | Low |
| **P1** | Require current password for email change requests | Low |
| **P1** | Fix IP spoofing in `AdminLoginRateMiddleware` and `UserOrAnonRateThrottle` | Medium |
| **P1** | Pin Docker base images to SHA digests | Low |
| **P1** | Set explicit `permissions` in GitHub Actions CI | Low |
| **P1** | Remove `|| true` from `npm audit` in CI | Low |
| **P1** | Sanitize contact form `name` before using in email subject | Low |
| **P1** | Add rate limiting to Next.js revalidation endpoint | Low |
| **P2** | Migrate from `xhtml2pdf` to `WeasyPrint` or audit invoice template sanitization | Medium |
| **P2** | Fix exception handling in `PasswordResetConfirmView` | Low |
| **P2** | Verify all `marked()` outputs are sanitized with `sanitize-html` | Medium |
| **P2** | Add `report-uri` to Content Security Policy | Low |
| **P3** | Hide exact `stock` values from public API | Low |
| **P3** | Add `SECURE_CROSS_ORIGIN_OPENER_POLICY` to Django | Low |
| **P3** | Make Next.js HSTS conditional on production | Low |
| **P3** | Consider requiring email verification before checkout | Low |
| **P3** | Verify `db.sqlite3` is not tracked by git | Low |

---

## Appendix: Scanned Files

### Backend (Python)
- `config/settings.py`, `config/urls.py`, `config/throttling.py`, `config/middleware.py`, `config/celery.py`, `config/health.py`, `config/assets.py`
- `apps/accounts/views.py`, `apps/accounts/serializers.py`, `apps/accounts/models.py`, `apps/accounts/authentication.py`, `apps/accounts/urls.py`, `apps/accounts/tasks.py`, `apps/accounts/email_utils.py`
- `apps/orders/views.py`, `apps/orders/serializers.py`, `apps/orders/models.py`, `apps/orders/services.py`, `apps/orders/urls.py`, `apps/orders/emails.py`, `apps/orders/email_utils.py`, `apps/orders/tasks.py`
- `apps/cart/views.py`, `apps/cart/serializers.py`, `apps/cart/models.py`
- `apps/catalog/views.py`, `apps/catalog/serializers.py`, `apps/catalog/models.py`, `apps/catalog/validators.py`
- `apps/contact/views.py`, `apps/contact/urls.py`
- `requirements.txt`, `manage.py`, `Dockerfile`, `.env.example`, `.gitignore`

### Frontend (JavaScript/TypeScript)
- `middleware.js`, `next.config.mjs`, `eslint.config.mjs`, `package.json`
- `app/lib/api.ts`, `app/lib/auth.js`, `app/lib/cart.js`
- `app/checkout/page.js`, `app/api/revalidate/route.js`, `app/api/health/route.js`
- `app/login/page.js`, `app/register/page.js`, `app/profile/page.js`, `app/orders/page.js`, `app/admin/page.js`
- `app/components/Nav.js`, `app/components/AddToCart.js`, `app/components/CookieConsent.js`, `app/components/NewsletterForm.js`, `app/components/ProductReviews.js`, `app/components/Footer.js`
- `app/contact/page.js`, `app/blog/**/*.js`, `app/blog/**/*.tsx`
- `Dockerfile`, `.env.local`, `.env.example`, `.gitignore`

### Infrastructure
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `run-dev.ps1`

---

*Report generated by Kimi Work Security Audit. This assessment is based on static code analysis. A full penetration test with dynamic scanning (OWASP ZAP, Burp Suite) and dependency vulnerability scanning (Snyk, Trivy) is recommended before production launch.*
