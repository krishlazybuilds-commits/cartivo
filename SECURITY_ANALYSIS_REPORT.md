# Cartivo Security Analysis Report

**Project:** Cartivo (Full-Stack E-Commerce Platform)  
**Backend:** Django 5.1 + DRF 3.15 + SimpleJWT (Python 3.12)  
**Frontend:** Next.js 15 + React 18 + TypeScript (Node 20)  
**Infrastructure:** Docker + PostgreSQL + Redis + MinIO + Celery + Stripe  
**Analysis Date:** June 23, 2026  
**Analyst:** Buffy (Codebuff AI Agent)

---

## Overall Assessment: **LOW RISK** — Well-Hardened Codebase

The Cartivo codebase demonstrates a **mature security posture**. A prior comprehensive security audit (`SECURITY_AUDIT_REPORT.md`) resolved **all 7 HIGH and 12 MEDIUM findings**. The current analysis corroborates those results and examines the codebase through the lens of specific attack vectors a hacker would attempt.

**All critical paths are protected.** An attacker would find no easy entry point.

---

## Executive Summary

This report analyzes the codebase from an attacker's perspective — how a hacker would attempt to compromise the application and what defenses stop them.

| Attack Vector | Status | Key Mitigations |
|---|---|---|
| XSS / Session Hijacking | 🟢 Protected | httpOnly JWT cookies, CSP with per-request nonces, no `unsafe-inline` in production |
| CSRF | 🟢 Protected | Enforced on **every** state-changing endpoint (including unauthenticated ones) |
| SQL Injection | 🟢 Protected | Django ORM exclusively — no raw SQL queries anywhere |
| Brute Force / Credential Stuffing | 🟢 Protected | 11+ rate limit scopes, admin login limiting, IP-based throttling |
| Payment Manipulation | 🟢 Protected | Server-side price calc, Stripe signature verification, row-level locks |
| Privilege Escalation | 🟢 Protected | `IsAdminUser`/`IsAuthenticated` guards, user-scoped querysets on all resources |
| Account Enumeration | 🟢 Protected | Generic error messages, consistent HTTP 200 on password-reset, HTTP 201 on duplicate registration |
| Email Spoofing | 🟢 Protected | Header injection sanitization, disposable email blocking (~80 domains) |
| IDOR (Insecure Direct Object Reference) | 🟢 Protected | Every queryset filtered to `request.user`; admin-only for staff views |
| Race Conditions | 🟢 Protected | `select_for_update()` row locks, `F()` atomic expressions, StripeEvent idempotency |
| Supply Chain | 🟢 Protected | SHA256-pinned Docker images, pinned GitHub Actions, pip-audit + npm audit in CI |
| IP Spoofing | 🟢 Protected | `get_client_ip()` ignores `X-Forwarded-For` unless from trusted proxies |

**Overall Risk Rating: LOW**

---

## 🚨 What Hackers Would Try — and Why They'd Fail

### 1. Session Hijacking via XSS

**Attack:** Inject `<script>` tags into a page to steal authentication tokens from JavaScript-accessible storage (localStorage, document.cookie).

**Why it fails:**

- **httpOnly cookies:** JWT access and refresh tokens are stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. JavaScript has **zero access** to them.

  ```python
  # backend/apps/accounts/views.py
  response.set_cookie(
      key,
      str(token),
      max_age=max_age,
      httponly=True,           # ← Not accessible to JavaScript
      secure=settings.AUTH_COOKIE_SECURE,  # ← HTTPS only in production
      samesite=settings.AUTH_COOKIE_SAMESITE,  # ← Lax
  )
  ```

- **Content Security Policy (CSP):** Strict CSP with per-request nonces blocks inline scripts without the correct nonce. No `unsafe-inline` in production.

  ```javascript
  // frontend/middleware.js
  const scriptSrc = [
      "'self'",
      `'nonce-${nonce}'`,  // ← Per-request nonce
      ...(isDev ? ["'unsafe-eval'"] : []),  // ← Only in dev mode
      "js.stripe.com",
      "accounts.google.com",
  ];
  ```

- **Only two `dangerouslySetInnerHTML` usages:**
  1. **Layout inline script** (`layout.js`): Uses a CSP nonce — protected.
  2. **Blog post rendering** (`blog/[slug]/page.js`): Content is **first-party only** (not user-generated) and sanitized via `sanitize-html`.

**Blind spots to monitor:**
- If blog ever accepts user-submitted content, the `dangerouslySetInnerHTML` in `blog/[slug]/page.js` becomes a HIGH risk.
- The `unsafe-eval` CSP bypass in development mode should never be deployed to production.

---

### 2. CSRF (Cross-Site Request Forgery)

**Attack:** Trick a logged-in user into visiting a malicious page that auto-submits a form to your API — changing their password, placing an order, or deleting their account.

**Why it fails:**

- **Every state-changing endpoint enforces CSRF.** This includes both authenticated and **unauthenticated** endpoints — a rare and strong defense.

  Authenticated endpoints are covered by `CookieJWTAuthentication`:
  ```python
  # backend/apps/accounts/authentication.py
  class CookieJWTAuthentication(JWTAuthentication):
      def authenticate(self, request):
          # ...token validation...
          # Cookie auth is vulnerable to CSRF, so enforce it
          enforce_csrf(request)  # ← Runs on every authenticated request
          return (user, validated_token)
  ```

  Unauthenticated endpoints explicitly call `enforce_csrf()`:
  ```python
  # backend/apps/accounts/views.py
  class RegisterView(generics.CreateAPIView):
      def create(self, request, *args, **kwargs):
          enforce_csrf(request)  # ← Registration requires CSRF token
  ```

  **All these unauthenticated POST endpoints have CSRF enforcement:**
  - `RegisterView.create`
  - `PasswordResetRequestView.post`
  - `PasswordResetConfirmView.post`
  - `EmailVerifyView.post`
  - `GuestCheckoutView.post`
  - `ShippingEstimateView.post`
  - `ValidateCouponView.post`
  - `Contact` view
  - `Subscribe` view
  - `GoogleLoginView.post`
  - `LoginView.post`
  - `RefreshView.post`
  - `LogoutView.post`

- The SPA reads the `csrftoken` cookie (which is NOT httpOnly so JS can read it) and sends it back in the `X-CSRFToken` header on all unsafe requests.

  ```javascript
  // frontend/app/lib/auth.js
  if (UNSAFE_METHODS.includes(method)) {
      const csrf = await ensureCsrfToken();
      if (csrf) headers["X-CSRFToken"] = csrf;
  }
  ```

---

### 3. Account Takeover via Brute Force

**Attack:** Try thousands of password combinations, password reset tokens, or registration attempts to compromise accounts.

**Why it fails:** Comprehensive multi-layered rate limiting.

| Scope | Rate | Endpoint |
|---|---|---|
| `login` | **10/min** per IP | Login, Google login |
| `register` | **5/hour** per IP | Registration |
| `password_reset` | **5/hour** per IP | Password reset request & confirm |
| `contact` | **5/hour** per IP | Contact form, newsletter |
| `order` | **20/min** per user/IP | Order creation (writes only) |
| `order_velocity` | **5/hour** per user/IP | Order velocity limit |
| `payment` | **10/min** per user/IP | Stripe checkout session creation |
| `coupon` | **10/min** per user/IP | Coupon validation |
| `shipping_estimate` | **30/min** per user/IP | Shipping estimate |
| `order_lookup` | **30/min** per user/IP | Guest order lookup |
| `cart` | **60/min** per user/IP | Cart operations (writes only) |
| **Admin login** | **10 per 5 min** per IP | Django admin (`/admin/login/`) |
| **Global anon** | **60/min** per IP | All other anonymous requests |
| **Global user** | **300/min** per user | All other authenticated requests |

**Additional protections:**
- Password reset tokens use Django's `default_token_generator` which creates time-limited, single-use tokens
- Login returns a generic error: `"Invalid username or password."` — doesn't reveal which is wrong
- Registration returns HTTP 201 even for existing emails (anti-enumeration)
- Password reset always says `"If that email exists, a reset link has been sent."`

---

### 4. Credential Stuffing / Account Enumeration

**Attack:** Use leaked credentials from other breaches or enumerate valid emails to target specific accounts.

**Why it fails:**

- **Registration anti-enumeration:** When an email already exists, returns HTTP 201 (same as success) **without** sending a verification email, so an attacker can't distinguish existing vs. new accounts.

  ```python
  # backend/apps/accounts/views.py
  class RegisterView(generics.CreateAPIView):
      def create(self, request, *args, **kwargs):
          enforce_csrf(request)
          serializer = self.get_serializer(data=request.data)
          serializer.is_valid(raise_exception=True)
          email = serializer.validated_data.get("email", "")
          if email and User.objects.filter(email__iexact=email).exists():
              return Response(serializer.data, status=status.HTTP_201_CREATED)  # ← Same status
          self.perform_create(serializer)
          self._send_verification_email(serializer.instance)
          return Response(serializer.data, status=status.HTTP_201_CREATED)
  ```

- **Password reset anti-enumeration:** Always returns the same message, regardless of whether the email exists.
- **Login anti-enumeration:** Generic error message doesn't distinguish invalid username vs. invalid password.
- **Disposable email blocking:** ~80 known disposable email domains are blocked at registration, contact form, email change, and newsletter subscription.
- **Gmail alias normalization:** `+` stripping and `.` removal prevent bypasses like `user+spam@gmail.com` or `u.ser@gmail.com`.

---

### 5. SQL Injection

**Attack:** Inject malicious SQL via search fields, URL parameters, or any user input to extract data, modify records, or escalate privileges.

**Why it fails:**

- **Django ORM exclusively:** The entire codebase uses Django's ORM with parameterized queries. **No raw SQL** (`RawSQL`, `cursor.execute()`, etc.) exists anywhere.
- All queries use ORM methods like:
  ```python
  User.objects.filter(email__iexact=email)
  Product.objects.filter(id__in=id_list)
  Order.objects.select_for_update().filter(pk=order_id, status=Order.Status.PENDING)
  ```
- The custom `PostgresSearchFilter` uses Django's full-text search (`SearchVector`, `SearchQuery`) which is parameterized.
- DRF serializers with explicit field types (`CharField(max_length=...)`, `IntegerField(min_value=...)`) provide input validation before data reaches the database.

---

### 6. Payment Manipulation

**Attack 1 — Price tampering:** Modify the price sent from the frontend to get items cheaper or free.

**Defense:** The backend **always calculates prices from the database**, never trusts the client.

```python
# backend/apps/orders/services.py
def create_order_and_items(*, order_kwargs, items, coupon=None):
    # ...
    product = locked_products.get(pid)
    unit_price = product.price  # ← Server-side price, not client-supplied
    # ...
    order_items.append(OrderItem(
        order=order,
        product=product,
        unit_price=unit_price,  # ← Always from DB
        quantity=qty,
    ))
```

Additionally, the checkout page itself validates guest cart prices against the server on mount:

```javascript
// frontend/app/checkout/page.js
const productIds = [...new Set(guestItems.map((i) => i.product_id))];
const res = await fetch(`${API_URL}/products/?ids=${productIds.join(",")}&page_size=100`);
// ...updates localStorage prices if they differ from server...
```

---

**Attack 2 — Pay less than owed:** Manipulate the Stripe Checkout Session to charge a different amount.

**Defense:** The webhook verifies the paid amount against the stored order total:

```python
# backend/apps/orders/views.py
def _handle_checkout_completed(event):
    # Security check: verify the paid amount matches our order total
    expected_cents = int(order.total * 100)
    actual_cents = session.get("amount_total")
    if actual_cents != expected_cents:
        logger.critical(
            "Payment amount mismatch for order %s: expected %s cents, got %s",
            order_id, expected_cents, actual_cents
        )
        return  # ← Doesn't mark order as paid
```

---

**Attack 3 — Double-refund:** Trigger a refund twice to get money back plus keep the items.

**Defense:** Multiple layers of race condition protection:

1. **`select_for_update()` row locking** ensures only one refund process runs at a time:
   ```python
   # backend/apps/orders/views.py
   with transaction.atomic():
       order = Order.objects.select_for_update().filter(
           pk=order.pk,
           status__in=(Order.Status.PAID, Order.Status.SHIPPED, Order.Status.DELIVERED),
       ).first()
   ```

2. **Status filtering:** Only `PAID`/`SHIPPED`/`DELIVERED` orders can be refunded. After refund, status becomes `REFUNDED`, which is excluded from future refunds.

3. **`StripeEvent` idempotency:** Duplicate webhook events are detected and skipped:
   ```python
   # backend/apps/orders/views.py
   try:
       with transaction.atomic():
           StripeEvent.objects.create(event_id=event_id, event_type=event_type)
           # ...handler runs inside same transaction...
   except IntegrityError:
       return JsonResponse({"received": True, "duplicate": True})  # ← Silently skip
   ```

---

### 7. Privilege Escalation

**Attack 1 — Regular user accesses admin endpoints:** Access `/api/v1/auth/admin/users/` to list all users, promote themselves, or impersonate others.

**Defense:** View-level permission checks:

```python
# backend/apps/accounts/views.py
class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAdminUser]  # ← Staff-only

    def _assert_target_modifiable(self, target):
        # Only superusers may modify other superusers
        if target.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied("Only a superuser can modify a superuser account.")

    def perform_update(self, serializer):
        # Block self-lockout: can't deactivate or demote yourself
        if target.pk == self.request.user.pk:
            if not new_is_active or not new_is_staff:
                raise ValidationError("You cannot deactivate or remove admin access from your own account.")
```

Admin endpoints across the codebase:
| Endpoint | Permission |
|---|---|
| `AdminUserViewSet` (all actions) | `IsAdminUser` |
| Order `process-refund`, `status`, `tracking`, `export` | `IsAdminUser` |
| `CouponViewSet` (all actions) | `IsAdminUser` |
| `WarehouseViewSet`, `WarehouseStockViewSet` | `IsAdminUser` |
| Product create/update/delete | `IsAdminUser` |
| Review approve/reject | `IsAdminUser` |
| `DashboardView` | `IsAdminUser` |

---

**Attack 2 — Access another user's data:** Modify order numbers, user IDs, or address IDs to view other people's data.

**Defense:** Every user-scoped endpoint filters by `request.user`:

```python
# backend/apps/accounts/views.py
class AddressViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)  # ← Own addresses only

# backend/apps/orders/views.py
class OrderViewSet(...):
    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all()  # ← Staff sees all
        return Order.objects.filter(user=self.request.user)  # ← Users see their own

# backend/apps/catalog/views.py
class ReviewViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if self.action in ("update", "partial_update", "destroy"):
            return qs.filter(user=user)  # ← Can only edit own reviews

class WishlistItemViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user)  # ← Own wishlist only
```

---

### 8. Email Header Injection

**Attack:** Submit `"John Doe\r\nBcc: thousands@spamlist.com"` in the contact form name to use your SMTP server as an open relay for spam.

**Why it fails:** The `_sanitize_name()` function strips all dangerous characters:

```python
# backend/apps/contact/views.py
_DANGEROUS_WS_RE = re.compile(r"[\r\n\f\v\t\x00]+")  # ← Newlines, null bytes, etc.
_SAFE_NAME_RE = re.compile(r"[^\w\s'.\-]")             # ← Only allows safe chars

def _sanitize_name(raw: str) -> str:
    s = _DANGEROUS_WS_RE.sub(" ", raw)  # ← Collapse dangerous whitespace
    s = _SAFE_NAME_RE.sub("", s)        # ← Remove unsafe characters
    return s.strip()
```

All user-supplied values in email subjects use the sanitized name, not the raw input.

---

### 9. IP Spoofing (Bypassing Rate Limits)

**Attack:** Set fake `X-Forwarded-For` headers to reset rate limit counters and bypass throttling.

**Why it fails:** The `get_client_ip()` utility is strict about who it trusts:

```python
# backend/config/utils.py
def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    remote_addr = request.META.get("REMOTE_ADDR", "")
    if xff:
        # Only trust X-Forwarded-For when REMOTE_ADDR is a known proxy
        if settings.TRUSTED_PROXIES and remote_addr in settings.TRUSTED_PROXIES:
            return xff.split(",")[0].strip()
    return remote_addr
```

In production, `TRUSTED_PROXIES` defaults to an empty list, meaning `X-Forwarded-For` is **completely ignored** unless the admin explicitly configures it. Every rate limiter (`UserOrAnonRateThrottle`, `AdminLoginRateMiddleware`) uses this same function.

---

### 10. Path Traversal / Arbitrary File Read

**Attack:** Access `../../../etc/passwd` through file uploads or static file endpoints.

**Why it fails:**

- **Static files** are served through WhiteNoise, which only serves files from `STATIC_ROOT` and `STATICFILES_DIRS`
- **Media files** (uploads) are served through Django's `static()` helper only in DEBUG mode. In production, S3/CDN is used
- **Image uploads** have strict validation:
  ```python
  # backend/apps/catalog/models.py
  validators=[
      FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),  # ← Extension whitelist
      validate_image_size,  # ← Max 5 MB
  ]
  ```
- The `auth_video` endpoint uses `FileResponse` which safely streams files, not a redirect

---

## 🔴 Remaining LOW-Level Issues

| # | Issue | Location | Risk | Notes |
|---|-------|----------|------|-------|
| 1 | **Auth hint bypassable via fake cookie** | `frontend/middleware.js` | 🟢 Low | Checks `request.cookies.has("refresh_token")` without validating the token. An attacker can set a fake `refresh_token` cookie to bypass redirects from `/login` to `/products`. **API still rejects invalid tokens** — this is a UI-only bypass. |
| 2 | **Stripe webhook accepts any IP** | `backend/apps/orders/views.py` | 🟢 Low | The webhook is `@csrf_exempt` (required for Stripe) and accepts POSTs from any IP. Stripe's signature verification (`stripe.Webhook.construct_event`) is cryptographically sound. Adding [Stripe's published IP ranges](https://stripe.com/docs/ips) would be defense-in-depth. |
| 3 | **Bulk import file validation** | `backend/apps/catalog/views.py` | 🟢 Low | CSV/XLSX import validates only by file extension, not by content-type or magic bytes. Risk is low — malformed files produce empty results, not code execution. Keep `openpyxl` updated. |
| 4 | **Blog `dangerouslySetInnerHTML`** | `frontend/app/blog/[slug]/page.js` | 🟢 Low | Currently safe because content is first-party and sanitized via `sanitize-html`. **Becomes HIGH risk if user-submitted content is ever allowed.** |
| 5 | **`NEXT_PUBLIC_API_URL` exposed to browser** | `frontend/app/lib/api.ts` | ℹ️ Info | The API URL is exposed to the browser via Next.js `NEXT_PUBLIC_` convention. Not a vulnerability, but worth being aware of. |
| 6 | **Password reset token in URL** | `backend/apps/accounts/views.py` | 🟢 Low | Reset tokens are transmitted as URL query parameters (`?uid=...&token=...`). These can be leaked via `Referer` headers or browser history. **Acceptable** because tokens are single-use, time-limited, and rate-limited at 5/hour/IP. |
| 7 | **Email verification token in URL** | `backend/apps/accounts/views.py` | 🟢 Low | Same pattern as password reset — tokens in URL. Same mitigations apply. |

---

## ✅ What's Done Exceptionally Well

### Authentication & Session Management

- **httpOnly JWT cookies** — Tokens never touch JavaScript
- **Refresh token rotation** — Every refresh issues a new token and blacklists the old one
- **Token blacklisting on logout** — `RefreshToken().blacklist()` instantly invalidates sessions
- **Password change revokes all other sessions** — `_revoke_all_refresh_tokens(user)` blacklists every outstanding token
- **Password reset revokes all sessions** — The user must re-authenticate on every device
- **Email verification required for checkout** — Prevents attackers from ordering with unverified accounts
- **CSRF enforcement on every state-changing endpoint** — Including unauthenticated POSTs (registration, password reset, guest checkout, etc.)

### Input Validation & Sanitization

- **DRF serializers** with explicit field types, max lengths, min/max values
- **Disposable email blocking** — ~80 domains + Gmail alias normalization
- **Email header injection sanitization** — `_sanitize_name()` strips all dangerous characters
- **File upload validation** — Extension whitelist `[jpg, jpeg, png, webp]` + 5 MB size limit
- **Bulk import** — CSV/XLSX parsing with row-level error handling

### Rate Limiting Architecture

- **3 custom throttle base classes** — `UserOrAnonRateThrottle`, `WriteRateThrottle`, and per-endpoint scopes
- **11 rate limit scopes** — Fine-grained controls per operation type
- **Reads unthrottled** — `WriteRateThrottle.allow_request()` exempts safe methods
- **Redis-backed** — Configurable via `REDIS_URL` for multi-worker consistency
- **IP spoofing resistant** — `get_client_ip()` ignores `X-Forwarded-For` by default

### Payment Security

- **Server-side price calculation** — Client-supplied prices are never trusted
- **Amount verification in webhook** — `amount_total` must match `order.total * 100`
- **Row-level locking** — `select_for_update()` prevents race conditions on stock, coupons, and order status
- **Idempotent webhook processing** — `StripeEvent` unique constraint prevents duplicate processing
- **Status state machine** — Only valid transitions allowed: PENDING→PAID→SHIPPED→DELIVERED or →CANCELLED/REFUNDED
- **Stripe Coupon for discounts** — Discount is applied as a Stripe coupon, not a manual price adjustment
- **Transaction rollback on Stripe failure** — Guest checkout rolls back the order if Stripe session creation fails

### Production Hardening

- **Startup validation** — Hard fails if `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, S3 credentials, or email settings are missing in production
- **CORS validation** — No wildcards, HTTPS only in production
- **ALLOWED_HOSTS validation** — No wildcards in production
- **CSRF_TRUSTED_ORIGINS validation** — HTTPS only in production
- **HSTS** — 1 year + includeSubDomains + preload
- **DEBUG guard** — Refuses to boot with DEBUG=True and a non-local host
- **SECRET_KEY guard** — Hard error if using the placeholder key in production
- **Security middleware** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `SECURE_SSL_REDIRECT`, `SECURE_CROSS_ORIGIN_OPENER_POLICY`
- **Permissions-Policy** — Restricted API, camera, microphone, geolocation, interest-cohort

### Infrastructure & CI/CD

- **SHA256-pinned Docker images** — All 7 image references pinned to manifest-list digests
- **Pinned GitHub Actions** — All third-party actions pinned to commit SHAs
- **Non-root Docker user** — Application containers don't run as root
- **pip-audit in CI** — Scans Python dependencies for known vulnerabilities on every push
- **npm audit in CI** — Fails on critical vulnerabilities in production dependencies
- **Dependabot** — Automated dependency update PRs
- **Sentry integration** — Optional error monitoring (doesn't collect PII: `send_default_pii=False`)

### Data Protection & Privacy

- **GDPR compliance** — Full data export (`GDPRExportView`) and anonymized deletion (`GDPRDeleteView`)
- **Password hashing** — Django's PBKDF2 algorithm with SHA-256
- **Stock levels hidden from public** — `ProductSerializer.get_fields()` removes `stock` for non-staff users
- **Order numbers are UUIDs** — Non-sequential, non-enumerable
- **Sentry configured with `send_default_pii=False`** — No PII sent to error monitoring

---

## 📊 Attack Surface Summary

| Attack Vector | Status | Mitigations |
|---|---|---|
| **XSS** | 🟢 **Protected** | httpOnly cookies, CSP with nonces, no UGC rendering, sanitize-html on blog |
| **CSRF** | 🟢 **Protected** | `enforce_csrf()` on every state-changing endpoint — both authenticated and unauthenticated |
| **SQL Injection** | 🟢 **Protected** | Django ORM exclusively — no raw SQL anywhere |
| **Brute Force** | 🟢 **Protected** | 11 rate limit scopes + admin login middleware (10/5min) + IP-based throttling |
| **Session Hijacking** | 🟢 **Protected** | httpOnly/Secure/SameSite cookies, token rotation + blacklisting |
| **Payment Tampering** | 🟢 **Protected** | Server-side price calc, Stripe sig verification, amount matching, row locks |
| **Privilege Escalation** | 🟢 **Protected** | IsAuthenticated/IsAdminUser guards, user-scoped querysets, self-lockout protection |
| **Email Spoofing** | 🟢 **Protected** | Header injection sanitization, disposable email blocking (~80 domains) |
| **Account Enumeration** | 🟢 **Protected** | Generic error messages, consistent HTTP status codes, disposable email blocking |
| **IDOR** | 🟢 **Protected** | User-scoped querysets on all resources: orders, addresses, reviews, wishlist |
| **Race Conditions** | 🟢 **Protected** | `select_for_update()` on stock/coupons/orders, `F()` expressions, StripeEvent idempotency |
| **Dependency Vulnerabilities** | 🟢 **Protected** | pip-audit + npm audit in CI, Dependabot enabled, SHA256-pinned images |
| **Supply Chain** | 🟢 **Protected** | SHA256-pinned Docker images, pinned GitHub Actions to commit SHAs |
| **IP Spoofing** | 🟢 **Protected** | `X-Forwarded-For` ignored unless from trusted proxies (empty by default) |
| **Host Header Injection** | 🟢 **Protected** | ALLOWED_HOSTS validated in production — no wildcards allowed |
| **Path Traversal** | 🟢 **Protected** | WhiteNoise static serving, Django `FileResponse`, file extension validation, S3 storage option |
| **Open Redirect** | 🟢 **Protected** | Stripe success/cancel URLs are hardcoded to frontend base URL — no user-supplied redirects |

---

## 🛡️ Defense-in-Depth Layering

The codebase demonstrates strong defense-in-depth. For example, consider what would need to happen for an attacker to successfully place a fraudulent order:

```
Layer 1: CSRF Token
  └─ Must have valid X-CSRFToken header (hard to forge without accessing csrftoken cookie)

Layer 2: Authentication
  └─ Must have valid httpOnly JWT cookies (not accessible to JS)
      └─ OR be a guest with a valid email (rate-limited)

Layer 3: Email Verification
  └─ Authenticated users must have verified their email (prevents bulk account creation attacks)

Layer 4: Rate Limiting
  └─ Order creation: 20/min + 5/hour velocity limit
  └─ Payment: 10/min

Layer 5: Stock Validation
  └─ `select_for_update()` row locks prevent overselling
  └─ CHECK constraint prevents negative stock

Layer 6: Server-Side Pricing
  └─ Prices always read from database, never from client

Layer 7: Stripe Webhook Verification
  └─ Signature verification (cryptographic)
  └─ Amount matching (server-calculated total vs. Stripe amount)
  └─ Idempotency (StripeEvent unique constraint)

Layer 8: Payment Intent Correlation
  └─ `stripe_payment_intent` stored on order for refund matching
  └─ Metadata propagated to PaymentIntent
```

---

## 📋 Recommended Next Steps

| Priority | Action | Effort | Area |
|---|---|---|---|
| **P3** | Add Stripe webhook IP allow-listing | Low | `backend/apps/orders/views.py` |
| **P3** | Add content-type validation for bulk CSV/XLSX import | Low | `backend/apps/catalog/views.py` |
| **P4** | Consider adding a lightweight `/auth/validate` endpoint for middleware token validation | Medium | `frontend/middleware.js`, `backend/apps/accounts/views.py` |
| **P4** | Run a dynamic penetration test (OWASP ZAP, Burp Suite) against staging | Medium | Pre-deployment |

---

## Appendix: Key Files Reviewed

| File | Purpose |
|---|---|
| `backend/config/settings.py` | Core Django settings — security, CORS, CSRF, auth, rate limiting |
| `backend/config/middleware.py` | Admin login rate limiting, Permissions-Policy middleware |
| `backend/config/throttling.py` | Custom rate limiter classes |
| `backend/config/utils.py` | `get_client_ip()` utility |
| `backend/apps/accounts/authentication.py` | CookieJWT auth, CSRF enforcement |
| `backend/apps/accounts/views.py` | Auth endpoints — register, login, password reset, Google OAuth, GDPR |
| `backend/apps/accounts/serializers.py` | Password validation, registration serializers |
| `backend/apps/accounts/email_utils.py` | Disposable email blocking, Gmail alias normalization |
| `backend/apps/orders/views.py` | Order creation, payment, Stripe webhook, refunds |
| `backend/apps/orders/services.py` | Order creation logic, stock management, coupon application |
| `backend/apps/orders/models.py` | Order, Coupon, StripeEvent models |
| `backend/apps/catalog/views.py` | Product CRUD, bulk import/export, reviews, wishlist |
| `backend/apps/catalog/serializers.py` | Product serializers (stock hidden from non-staff) |
| `backend/apps/catalog/validators.py` | Image size validator |
| `backend/apps/catalog/filters.py` | Postgres search filter (safe from SQL injection) |
| `backend/apps/contact/views.py` | Contact form, newsletter (header injection sanitization) |
| `frontend/middleware.js` | Route protection, CSP with nonces |
| `frontend/next.config.mjs` | Security headers (HSTS, X-Frame-Options, etc.) |
| `frontend/app/lib/auth.js` | Auth context, CSRF token management, token refresh |
| `frontend/app/lib/api.ts` | API fetch with ISR caching |
| `frontend/app/checkout/page.js` | Guest price validation against server |
| `frontend/app/components/AddToCart.js` | Cart add item with stock awareness |
| `frontend/app/components/ProductReviews.js` | Review submission (authenticated only) |
| `frontend/package.json` | Dependencies, security overrides |
| `SECURITY_AUDIT_REPORT.md` | Prior audit report (all findings resolved) |

---

*Report generated by Buffy (Codebuff AI Agent) on June 23, 2026. This assessment is based on static code analysis of the current codebase. A dynamic penetration test with tools like OWASP ZAP or Burp Suite is recommended before major production launch.*
