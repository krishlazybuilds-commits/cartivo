import re
import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseForbidden

_ADMIN_LOGIN_RE = re.compile(r"^/admin/login/")
_RATE = 10       # max attempts
_PERIOD = 300    # seconds (5 minutes)
_PREFIX = "admin_login_rate:"


class AdminLoginRateMiddleware:
    """Rate-limit POSTs to /admin/login/ by IP to prevent brute-force attacks."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "POST" and _ADMIN_LOGIN_RE.match(request.path_info):
            ip = self._get_ip(request)
            key = f"{_PREFIX}{ip}"
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
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
