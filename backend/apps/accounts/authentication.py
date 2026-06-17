"""
Cookie-based JWT authentication.

Reads the access token from an httpOnly cookie instead of the Authorization
header, so the token is never exposed to JavaScript (XSS-safe). Because cookies
are sent automatically by the browser, this also enforces CSRF protection on
unsafe (state-changing) requests — the client must echo the `csrftoken` cookie
back in the `X-CSRFToken` header.
"""

import logging

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)


class _CSRFCheck(CsrfViewMiddleware):
    """CsrfViewMiddleware variant that returns the failure reason instead of a response."""

    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    """Run Django's CSRF checks against a DRF request, raising on failure.

    Safe methods (GET/HEAD/OPTIONS/TRACE) are skipped by the middleware itself.
    """
    logger.info("enforce_csrf — request method: %s, origin: %s, referer: %s",
                request.method, request.META.get("HTTP_ORIGIN"), request.META.get("HTTP_REFERER"))
    logger.info("enforce_csrf — cookies keys: %s", list(request.COOKIES.keys()))
    logger.info("enforce_csrf — X-CSRFToken header: %s", request.META.get("HTTP_X_CSRFTOKEN", "(not set)"))
    check = _CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        logger.warning("CSRF check FAILED: %s", reason)
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIE)

        if raw_token is None:
            # Fall back to the Authorization header (handy for API tools/tests).
            header = self.get_header(request)
            if header is None:
                return None
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        # Cookie auth is vulnerable to CSRF, so enforce it for authenticated
        # users on unsafe methods.
        enforce_csrf(request)

        return (user, validated_token)
