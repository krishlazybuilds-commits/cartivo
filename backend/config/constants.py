"""Shared constants for the Cartivo backend."""

# Shared Celery retry policy: retry any exception with capped exponential backoff.
RETRY_KWARGS = {
    "autoretry_for": (Exception,),
    "retry_backoff": True,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 5,
}

# Lighter retry policy for non-critical background tasks (e.g. low-stock alerts).
RETRY_KWARGS_LIGHT = {
    "autoretry_for": (Exception,),
    "retry_backoff": True,
    "retry_backoff_max": 300,
    "retry_jitter": True,
    "max_retries": 3,
}

ADMIN_LOGIN_RATE_PREFIX = "admin_login_rate:"
