import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


logger = logging.getLogger(__name__)


@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def send_abandoned_cart_emails_task():
    """Find carts inactive for 2+ hours and send a recovery email with a discount code."""
    from apps.cart.models import Cart
    from apps.orders.models import Coupon

    cutoff = timezone.now() - timedelta(hours=2)

    # Find carts with items that belong to active users with emails,
    # haven't been updated in 2 hours, and haven't received a recovery email yet.
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

    # Ensure a default recovery coupon exists
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

    sent_count = 0
    for cart in abandoned_carts:
        user = cart.user
        items_list = []
        for item in cart.items.all():
            suffix = f" ({item.variant.name})" if item.variant_id else ""
            items_list.append(f"- {item.quantity}x {item.product.name}{suffix}")

        items_text = "\n".join(items_list)

        try:
            send_mail(
                subject="We noticed you left something in your cart!",
                message=(
                    f"Hi {user.first_name or user.username},\n\n"
                    f"You left some items in your Cartivo shopping cart. We've saved them for you!\n\n"
                    f"Here is what's waiting for you:\n"
                    f"{items_text}\n\n"
                    f"To help you complete your purchase, use code {coupon.code} at checkout for 10% off your entire order!\n\n"
                    f"Return to your cart here: {getattr(settings, 'CORS_ALLOWED_ORIGINS', ['http://localhost:3000'])[0]}/cart\n\n"
                    f"Best regards,\n"
                    f"The Cartivo Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
            cart.abandoned_email_sent = True
            cart.save(update_fields=["abandoned_email_sent"])
            sent_count += 1
        except Exception:
            logger.exception("Failed to send abandoned cart email to user %s", user.email)

    logger.info("Sent %s abandoned cart recovery email(s).", sent_count)
    return sent_count
