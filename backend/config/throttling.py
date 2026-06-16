"""Rate throttles for the Cartivo API.

Authenticated users are throttled per-user (by user ID); anonymous users are
throttled per-IP (by ``get_ident``).  Reads (safe methods) are never throttled
so browsing stays fast; only writes (POST/PUT/PATCH/DELETE) count against the
rate.  Rates are defined in ``settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]``
keyed by ``scope``.
"""

from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import SimpleRateThrottle


class UserOrAnonRateThrottle(SimpleRateThrottle):
    """Per-user throttle for authenticated requests; per-IP for anonymous.

    This avoids the ``UserRateThrottle`` pitfall where all anonymous users
    share a single cache key (``pk=None``), which lets a single attacker
    exhaust the entire anonymous allocation.  Instead each IP gets its own
    bucket while authenticated users continue to be limited per-account.
    """

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class WriteRateThrottle(UserOrAnonRateThrottle):
    """Throttle only unsafe (write) requests; let reads through untouched."""

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)


class CartWriteThrottle(WriteRateThrottle):
    scope = "cart"


class OrderWriteThrottle(WriteRateThrottle):
    scope = "order"


class PaymentThrottle(UserOrAnonRateThrottle):
    """Tighter limit for payment-session creation (hits Stripe)."""

    scope = "payment"


class CouponAnonThrottle(WriteRateThrottle):
    """Rate-limit coupon validation to prevent brute-force enumeration."""

    scope = "coupon"


class ShippingEstimateAnonThrottle(WriteRateThrottle):
    """Rate-limit shipping estimate requests."""

    scope = "shipping_estimate"
