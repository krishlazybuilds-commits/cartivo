import re
import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseForbidden

from .utils import get_client_ip

from .constants import ADMIN_LOGIN_RATE_PREFIX

_ADMIN_LOGIN_RE = re.compile(r"^/admin/login/")
_RATE = 10       # max attempts
_PERIOD = 300    # seconds (5 minutes)

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
