"""Background tasks for order emails.

These run on Celery (Redis broker) so SMTP latency and transient failures stay
off the request/webhook cycle. Failures are retried automatically with
exponential backoff; after the final attempt the error is logged.
"""

import logging

from celery import shared_task
from django.core.management import call_command

from .emails import send_order_confirmation, send_payment_confirmed
from .models import Order

logger = logging.getLogger(__name__)

# Shared retry policy: retry any exception with capped exponential backoff.
_RETRY_KWARGS = {
    "autoretry_for": (Exception,),
    "retry_backoff": True,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 5,
}


def _load_order(order_id):
    return (
        Order.objects.filter(pk=order_id)
        .select_related("user")
        .prefetch_related("items__product")
        .first()
    )


@shared_task(bind=True, **_RETRY_KWARGS)
def send_order_confirmation_task(self, order_id):
    order = _load_order(order_id)
    if order is None:
        logger.warning("send_order_confirmation_task: order %s not found", order_id)
        return
    send_order_confirmation(order)


@shared_task(bind=True, **_RETRY_KWARGS)
def send_payment_confirmed_task(self, order_id):
    order = _load_order(order_id)
    if order is None:
        logger.warning("send_payment_confirmed_task: order %s not found", order_id)
        return
    send_payment_confirmed(order)


@shared_task
def expire_pending_orders_task(minutes=30):
    """Cancel + restock unpaid PENDING orders older than ``minutes``.

    Runs on a Celery Beat schedule so reserved stock from abandoned checkouts is
    released automatically. Delegates to the existing management command, which
    locks each order row and re-checks status to avoid racing the payment
    webhook or a manual cancel.
    """
    call_command("expire_pending_orders", minutes=minutes)
