import logging

from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def _send(subject, body, recipient):
    """Send an email.

    Raises on failure so the calling Celery task can retry. These helpers are
    invoked from background tasks (see apps.orders.tasks), so SMTP latency and
    transient errors are kept off the request cycle and retried automatically.
    """
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
    )


def send_order_confirmation(order):
    """Send an order confirmation email to the customer."""
    user = order.user
    recipient = user.email if user else order.guest_email
    if not recipient:
        logger.warning("send_order_confirmation: no recipient for order %s", order.id)
        return
    name = (user.first_name or user.email) if user else order.guest_email
    items_lines = "\n".join(
        f"  {item.quantity} x {item.product.name}  ${item.subtotal:.2f}"
        for item in order.items.select_related("product")
    )
    body = (
        f"Hi {name},\n\n"
        f"Thanks for your order! Here's your summary:\n\n"
        f"Order #{order.id}\n"
        f"{'-' * 30}\n"
        f"{items_lines}\n"
        f"{'-' * 30}\n"
        f"Total: ${order.total:.2f}\n\n"
        f"Shipping to:\n"
        f"  {order.shipping_full_name}\n"
        f"  {order.shipping_address}, {order.shipping_city}\n"
        f"  {order.shipping_postal_code}, {order.shipping_country}\n\n"
        f"We'll notify you when your order ships.\n\n"
        f"— The Cartivo Team"
    )
    _send(f"Order #{order.id} confirmed — Cartivo", body, recipient)


def send_payment_confirmed(order):
    """Send a payment confirmed email to the customer."""
    user = order.user
    recipient = user.email if user else order.guest_email
    if not recipient:
        logger.warning("send_payment_confirmed: no recipient for order %s", order.id)
        return
    name = (user.first_name or user.email) if user else order.guest_email
    body = (
        f"Hi {name},\n\n"
        f"Your payment for Order #{order.id} has been received. "
        f"We're now preparing your order.\n\n"
        f"Total charged: ${order.total:.2f}\n\n"
        f"Shipping to:\n"
        f"  {order.shipping_full_name}\n"
        f"  {order.shipping_address}, {order.shipping_city}\n"
        f"  {order.shipping_postal_code}, {order.shipping_country}\n\n"
        f"— The Cartivo Team"
    )
    _send(f"Payment received for Order #{order.id} — Cartivo", body, recipient)
