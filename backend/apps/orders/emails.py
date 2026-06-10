import logging

from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def _safe_send(subject, body, recipient):
    """Send an email, logging (not raising) on failure so flows aren't broken."""
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
        )
    except Exception:
        logger.exception("Failed to send email '%s' to %s", subject, recipient)


def send_order_confirmation(order):
    """Send an order confirmation email to the customer."""
    user = order.user
    items_lines = "\n".join(
        f"  {item.quantity} x {item.product.name}  ${item.subtotal:.2f}"
        for item in order.items.select_related("product")
    )
    body = (
        f"Hi {user.first_name or user.email},\n\n"
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
    _safe_send(f"Order #{order.id} confirmed — Cartivo", body, user.email)


def send_payment_confirmed(order):
    """Send a payment confirmed email to the customer."""
    user = order.user
    body = (
        f"Hi {user.first_name or user.email},\n\n"
        f"Your payment for Order #{order.id} has been received. "
        f"We're now preparing your order.\n\n"
        f"Total charged: ${order.total:.2f}\n\n"
        f"Shipping to:\n"
        f"  {order.shipping_full_name}\n"
        f"  {order.shipping_address}, {order.shipping_city}\n"
        f"  {order.shipping_postal_code}, {order.shipping_country}\n\n"
        f"— The Cartivo Team"
    )
    _safe_send(f"Payment received for Order #{order.id} — Cartivo", body, user.email)
