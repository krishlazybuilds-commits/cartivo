"""
Redis-backed account lockout for credential-stuffing protection.

Tracks failed login attempts per user identity (normalized email/username)
using Django's cache framework.  When the attempt threshold is exceeded the
account is temporarily locked.  On success the counter resets.

In production the cache backend is Redis (shared across workers); in
development and tests it falls back to LocMemCache so no Redis dependency
is required to run the test suite.
"""

import logging
import time

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache key prefixes.
_COUNTER_PREFIX = "account_lockout:"
_LOCKED_PREFIX = "account_lockout_locked:"


def _cfg(key: str, default: int) -> int:
    """Read an integer setting, falling back to *default* when not present."""
    return getattr(settings, key, default)


def _max_attempts() -> int:
    return _cfg("ACCOUNT_LOCKOUT_MAX_ATTEMPTS", 10)


def _window_seconds() -> int:
    return _cfg("ACCOUNT_LOCKOUT_WINDOW_MINUTES", 15) * 60


def _lockout_seconds() -> int:
    return _cfg("ACCOUNT_LOCKOUT_DURATION_MINUTES", 15) * 60


def _counter_key(ident: str) -> str:
    return f"{_COUNTER_PREFIX}{ident}"


def _locked_key(ident: str) -> str:
    return f"{_LOCKED_PREFIX}{ident}"


def record_failed_attempt(ident: str) -> int:
    """Increment the failed-attempt counter for *ident*.

    Returns the new attempt count.  If the count now meets or exceeds
    ``ACCOUNT_LOCKOUT_MAX_ATTEMPTS`` the account is also marked as locked.

    Uses ``get`` + ``set`` instead of ``incr`` to ensure the TTL is
    refreshed (sliding window) on every failed attempt.
    """
    key = _counter_key(ident)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, _window_seconds())

    if attempts >= _max_attempts():
        # Store the absolute expiry timestamp so ``lockout_remaining_seconds``
        # can compute remaining time without needing ``cache.ttl()`` (which
        # is not supported by all backends, e.g. LocMemCache).
        lockout_expires_at = time.time() + _lockout_seconds()
        cache.set(_locked_key(ident), lockout_expires_at, _lockout_seconds())
        logger.warning(
            "Account locked after %d failed attempts: %s", attempts, ident
        )

    return attempts


def is_locked_out(ident: str) -> bool:
    """Return *True* if *ident* is currently locked out."""
    raw = cache.get(_locked_key(ident))
    return raw is not None


def lockout_remaining_seconds(ident: str) -> int:
    """Return how many seconds remain in the lockout (0 if not locked).

    Reads the stored absolute expiry timestamp rather than relying on
    ``cache.ttl()`` for compatibility with LocMemCache and other backends
    that do not implement the ``ttl`` method.
    """
    expires_at = cache.get(_locked_key(ident))
    if expires_at is None:
        return 0
    remaining = expires_at - time.time()
    return max(int(remaining), 0)


def clear_attempts(ident: str) -> None:
    """Reset the failed-attempt counter and remove any lockout for *ident*."""
    cache.delete(_counter_key(ident))
    cache.delete(_locked_key(ident))
