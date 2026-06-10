from django.core.mail import send_mail
from django.conf import settings


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
    send_mail(
        subject=f"Order #{order.id} confirmed — Cartivo",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )


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
    send_mail(
        subject=f"Payment received for Order #{order.id} — Cartivo",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
