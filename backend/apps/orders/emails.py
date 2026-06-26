import logging

from .email_utils import send_html_email

logger = logging.getLogger(__name__)


def send_order_confirmation(order):
    """Send an order confirmation email to the customer."""
    user = order.user
    recipient = user.email if user else order.guest_email
    if not recipient:
        logger.warning("send_order_confirmation: no recipient for order %s", order.id)
        return
    name = (user.first_name or user.email) if user else order.guest_email
    items = list(order.items.select_related("product", "variant"))
    items_lines = "\n".join(
        f"  {item.quantity} x {item.product.name}"
        + (f" ({item.variant.name})" if item.variant else "")
        + f"  ${item.subtotal:.2f}"
        for item in items
    )
    text_body = (
        f"Hi {name},\n\n"
        f"Thanks for your order! Here's your summary:\n\n"
        f"Order {order.order_number_short}\n"
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
    send_html_email(
        subject=f"Order {order.order_number_short} confirmed — Cartivo",
        html_template="emails/order_confirmation.html",
        text_body=text_body,
        recipient_list=[recipient],
        context={"name": name, "order": order, "items": items},
    )


def send_payment_confirmed(order):
    """Send a payment confirmed email to the customer."""
    user = order.user
    recipient = user.email if user else order.guest_email
    if not recipient:
        logger.warning("send_payment_confirmed: no recipient for order %s", order.id)
        return
    name = (user.first_name or user.email) if user else order.guest_email
    text_body = (
        f"Hi {name},\n\n"
        f"Your payment for Order {order.order_number_short} has been received. "
        f"We're now preparing your order.\n\n"
        f"Total charged: ${order.total:.2f}\n\n"
        f"Shipping to:\n"
        f"  {order.shipping_full_name}\n"
        f"  {order.shipping_address}, {order.shipping_city}\n"
        f"  {order.shipping_postal_code}, {order.shipping_country}\n\n"
        f"— The Cartivo Team"
    )
    send_html_email(
        subject=f"Payment received for Order {order.order_number_short} — Cartivo",
        html_template="emails/payment_confirmed.html",
        text_body=text_body,
        recipient_list=[recipient],
        context={"name": name, "order": order},
    )
