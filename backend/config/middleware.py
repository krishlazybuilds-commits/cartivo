import logging
import re
import time

from django.core.cache import cache
from django.http import HttpResponseForbidden

from .utils import get_client_ip

from .constants import ADMIN_LOGIN_RATE_PREFIX

logger = logging.getLogger("apps.middleware")

_ADMIN_LOGIN_RE = re.compile(r"^/admin/login/")
_RATE = 10  # max attempts
_PERIOD = 300  # seconds (5 minutes)

# Permissions-Policy matching the frontend's policy in next.config.mjs.
_PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), interest-cohort=()"


class AdminLoginRateMiddleware:
    """Rate-limit POSTs to /admin/login/ by IP to prevent brute-force attacks."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and _ADMIN_LOGIN_RE.match(request.path_info):
            ip = self._get_ip(request)
            key = f"{ADMIN_LOGIN_RATE_PREFIX}{ip}"
            window = cache.get(key, [])
            now = time.time()
            window = [t for t in window if now - t < _PERIOD]
            if len(window) >= _RATE:
                return HttpResponseForbidden("Too many login attempts. Try again later.")
            window.append(now)
            cache.set(key, window, _PERIOD)
        return self.get_response(request)

    @staticmethod
    def _get_ip(request):
        return get_client_ip(request)


class PermissionsPolicyMiddleware:
    """Set the Permissions-Policy header on every response.

    Mirrors the policy already applied by the Next.js frontend so that direct
    API clients are also restricted.  Django has no built-in setting for this
    header, so a small middleware is the cleanest approach.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Permissions-Policy"] = _PERMISSIONS_POLICY
        return response


class RequestLoggingMiddleware:
    """Log every request with method, path, status, IP, and duration.

    Failed requests (4xx/5xx) are logged at WARNING/ERROR with the full
    request body so you can see exactly what was sent.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = get_client_ip(request)
        body = self._safe_body(request)
        start = time.time()

        response = self.get_response(request)

        elapsed = int((time.time() - start) * 1000)
        status = response.status_code
        path = request.get_full_path()
        method = request.method

        if status >= 500:
            logger.error(
                "%-6s %3d  %4dms  %-15s  %s%s",
                method, status, elapsed, ip, path,
                f"  body={body}" if body else "",
            )
        elif status >= 400:
            logger.warning(
                "%-6s %3d  %4dms  %-15s  %s%s",
                method, status, elapsed, ip, path,
                f"  body={body}" if body else "",
            )
        else:
            logger.debug(
                "%-6s %3d  %4dms  %-15s  %s",
                method, status, elapsed, ip, path,
            )

        return response

    @staticmethod
    def _safe_body(request):
        """Read the request body without consuming the stream (best-effort)."""
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return ""
        try:
            raw = request.body
            if not raw:
                return ""
            text = raw.decode("utf-8", errors="replace")
            return text[:500]  # truncate long payloads
        except Exception:
            return "<unreadable>"
