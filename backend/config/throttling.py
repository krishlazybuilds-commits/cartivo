"""Rate throttles for authenticated, mutating API endpoints.

Reads (safe methods) are never throttled so browsing stays fast; only writes
(POST/PUT/PATCH/DELETE) count against the per-user rate. Rates are defined in
settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] keyed by ``scope``.
"""

from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import UserRateThrottle


class WriteRateThrottle(UserRateThrottle):
    """Throttle only unsafe (write) requests; let reads through untouched."""

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)


class CartWriteThrottle(WriteRateThrottle):
    scope = "cart"


class OrderWriteThrottle(WriteRateThrottle):
    scope = "order"


class PaymentThrottle(UserRateThrottle):
    """Tighter limit for payment-session creation (hits Stripe)."""

    scope = "payment"


class CouponAnonThrottle(WriteRateThrottle):
    """Rate-limit coupon validation to prevent brute-force enumeration."""

    scope = "coupon"


class ShippingEstimateAnonThrottle(WriteRateThrottle):
    """Rate-limit shipping estimate requests."""

    scope = "shipping_estimate"
