"""Lightweight health/readiness endpoint for load balancers and orchestrators."""

import logging

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health(request):
    """Report service health, checking database and cache connectivity.

    Returns 200 when all checks pass, 503 otherwise. Intended for liveness/
    readiness probes; it intentionally exposes no sensitive details.
    """
    checks = {}
    healthy = True

    try:
        connection.ensure_connection()
        checks["database"] = "ok"
    except Exception:
        logger.exception("Health check: database connection failed")
        checks["database"] = "error"
        healthy = False

    try:
        cache.set("healthcheck", "1", 5)
        checks["cache"] = "ok" if cache.get("healthcheck") == "1" else "error"
        if checks["cache"] != "ok":
            healthy = False
    except Exception:
        logger.exception("Health check: cache failed")
        checks["cache"] = "error"
        healthy = False

    return JsonResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
