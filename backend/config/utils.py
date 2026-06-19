from django.conf import settings


def get_client_ip(request):
    """Return the real client IP, only trusting X-Forwarded-For from known proxies."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    remote_addr = request.META.get("REMOTE_ADDR", "")
    trusted_proxies = getattr(settings, "TRUSTED_PROXIES", [])
    if xff and remote_addr in trusted_proxies:
        return xff.split(",")[0].strip()
    return remote_addr
