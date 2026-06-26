import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.orders.email_utils import send_html_email
from config.constants import RETRY_KWARGS_LIGHT

logger = logging.getLogger(__name__)


@shared_task(**RETRY_KWARGS_LIGHT)
def send_abandoned_cart_emails_task():
    """Find carts inactive for 2+ hours and send a recovery email with a discount code."""
    from apps.cart.models import Cart
    from apps.orders.models import Coupon

    cutoff = timezone.now() - timedelta(hours=2)

    abandoned_carts = (
        Cart.objects.filter(
            items__isnull=False,
            abandoned_email_sent=False,
            updated_at__lt=cutoff,
            user__is_active=True,
        )
        .exclude(user__email="")
        .distinct()
        .select_related("user")
        .prefetch_related("items__product")
    )

    if not abandoned_carts.exists():
        logger.info("No abandoned carts found to recover.")
        return 0

    coupon, created = Coupon.objects.get_or_create(
        code="COMEBACK10",
        defaults={
            "discount_type": Coupon.DiscountType.PERCENT,
            "value": 10.00,
            "min_order_amount": 0.00,
            "max_uses": 0,
            "is_active": True,
        },
    )

    cart_url = f"{getattr(settings, 'CORS_ALLOWED_ORIGINS', ['http://localhost:3000'])[0]}/cart"
    sent_count = 0
    for cart in abandoned_carts:
        user = cart.user
        name = user.first_name or user.username
        items = []
        for item in cart.items.all():
            suffix = f" ({item.variant.name})" if item.variant_id else ""
            items.append({"quantity": item.quantity, "name": f"{item.product.name}{suffix}"})

        items_text = "\n".join(f"- {i['quantity']}x {i['name']}" for i in items)

        text_body = (
            f"Hi {name},\n\n"
            f"You left some items in your Cartivo shopping cart. We've saved them for you!\n\n"
            f"Here is what's waiting for you:\n"
            f"{items_text}\n\n"
            f"To help you complete your purchase, use code "
            f"{coupon.code} at checkout for 10% off your entire order!\n\n"
            f"Return to your cart here: {cart_url}\n\n"
            f"Best regards,\n"
            f"The Cartivo Team"
        )
        try:
            send_html_email(
                subject="We noticed you left something in your cart!",
                html_template="emails/abandoned_cart.html",
                text_body=text_body,
                recipient_list=[user.email],
                context={
                    "name": name,
                    "items": items,
                    "coupon_code": coupon.code,
                    "cart_url": cart_url,
                },
            )
            cart.abandoned_email_sent = True
            cart.save(update_fields=["abandoned_email_sent"])
            sent_count += 1
        except Exception:
            logger.exception("Failed to send abandoned cart email to user %s", user.email)

    logger.info("Sent %s abandoned cart recovery email(s).", sent_count)
    return sent_count
