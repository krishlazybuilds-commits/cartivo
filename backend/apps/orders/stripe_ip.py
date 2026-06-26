"""
Defense-in-depth: validate that incoming Stripe webhook requests originate from
Stripe's published IP addresses before processing them.

Stripe's cryptographic signature verification (``stripe.Webhook.construct_event``)
is the primary security mechanism. This module adds an IP allow-list as a
secondary layer — if an attacker somehow obtains the webhook secret, they would
still need to send requests from Stripe's IP range.

Stripe publishes the current webhook IP list at:
    https://stripe.com/files/ips/ips_webhooks.json

The list is cached for 24 hours via Django's cache framework (Redis in
production, LocMemCache in development).  A hardcoded fallback ensures the
webhook continues to work even when Stripe's endpoint is unreachable.

Usage in a view::

    from .stripe_ip import validate_stripe_ip

    def my_webhook(request):
        if not validate_stripe_ip(request):
            return HttpResponse(status=403)
        ...
"""

import ipaddress
import json
import logging
from urllib.request import Request, urlopen
from urllib.error import URLError

from django.conf import settings
from django.core.cache import cache

from config.utils import get_client_ip
from .constants import STRIPE_WEBHOOK_IPS_URL, STRIPE_IP_CACHE_KEY, STRIPE_IP_CACHE_TTL

logger = logging.getLogger(__name__)

# Fallback IPs used when Stripe's published list cannot be fetched.
# Last updated: June 2026 — from https://stripe.com/files/ips/ips_webhooks.json
_FALLBACK_STRIPE_WEBHOOK_IPS = [
    "3.18.12.63",
    "3.69.109.8",
    "3.120.168.93",
    "3.130.192.231",
    "13.235.14.237",
    "13.235.122.149",
    "18.211.135.69",
    "35.154.171.200",
    "35.157.207.129",
    "52.15.183.38",
    "54.88.130.119",
    "54.88.130.237",
    "54.187.174.169",
    "54.187.205.235",
    "54.187.216.72",
]


def _fetch_stripe_webhook_ips() -> list[str]:
    """Fetch the latest Stripe webhook IPs from Stripe's JSON endpoint.

    Falls back to the hardcoded list on any error (network failure, timeout,
    malformed response) so the webhook is never disrupted by a transient fetch
    failure.
    """
    try:
        req = Request(STRIPE_WEBHOOK_IPS_URL, headers={"Accept": "application/json"})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        ips = data.get("WEBHOOKS", [])
        if isinstance(ips, list) and ips:
            return ips
        logger.warning("Stripe webhook IP list is empty; using fallback.")
    except (URLError, json.JSONDecodeError, OSError) as exc:
        logger.warning(
            "Failed to fetch Stripe webhook IPs from %s: %s; using fallback.",
            STRIPE_WEBHOOK_IPS_URL,
            exc,
        )
    return _FALLBACK_STRIPE_WEBHOOK_IPS


def get_stripe_webhook_ips() -> list[str]:
    """Return cached Stripe webhook IPs, fetching from Stripe if not cached.

    Results are cached for 24 hours (``STRIPE_IP_CACHE_TTL``).  The cache key
    can be invalidated manually via ``cache.delete("stripe_webhook_ips")``
    should an emergency refresh be needed without waiting for the TTL.
    """
    ips = cache.get(STRIPE_IP_CACHE_KEY)
    if ips is not None:
        return ips
    ips = _fetch_stripe_webhook_ips()
    cache.set(STRIPE_IP_CACHE_KEY, ips, STRIPE_IP_CACHE_TTL)
    return ips


def is_stripe_ip(client_ip: str) -> bool:
    """Check whether *client_ip* falls within Stripe's webhook IP ranges.

    Handles both individual IP addresses and CIDR notation (in case Stripe
    publishes ranges in the future).  Returns ``True`` if the IP is within
    one of Stripe's published ranges, ``False`` otherwise.
    """
    try:
        addr = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    stripe_ips = get_stripe_webhook_ips()
    for entry in stripe_ips:
        try:
            network = ipaddress.ip_network(entry, strict=False)
            if addr in network:
                return True
        except ValueError:
            # Skip malformed entries (should not happen with Stripe data).
            continue
    return False


def validate_stripe_ip(request) -> bool:
    """Validate that the incoming request originates from a Stripe webhook IP.

    Uses ``get_client_ip()`` to correctly resolve the client IP behind reverse
    proxies (nginx, ALB, etc.).  Returns ``True`` if the client IP is in
    Stripe's allow-list or if the IP cannot be determined.  Returns ``False``
    and logs a warning when the IP is explicitly outside the allow-list.

    Disabled during tests so the test suite does not require mock IPs.

    This is a defense-in-depth check — the primary security is the
    ``Stripe-Signature`` header verification.
    """
    if not getattr(settings, "STRIPE_IP_CHECK_ENABLED", True):
        return True

    client_ip = get_client_ip(request)
    if not client_ip:
        # Can't determine the client IP — be permissive and let signature
        # verification be the sole gate.
        return True

    if is_stripe_ip(client_ip):
        return True

    logger.warning(
        "Stripe webhook rejected from non-Stripe IP: %s",
        client_ip,
    )
    return False
