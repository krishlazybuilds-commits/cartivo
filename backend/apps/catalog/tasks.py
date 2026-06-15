import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
)
def send_low_stock_alert_task(product_id):
    """Email all staff users when a product's stock drops to or below LOW_STOCK_THRESHOLD."""
    from .models import Product  # local import avoids circular at module load

    threshold = getattr(settings, "LOW_STOCK_THRESHOLD", 5)

    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return

    if product.stock > threshold:
        return  # stock recovered between task enqueue and execution — skip

    User = get_user_model()
    staff_emails = list(
        User.objects.filter(is_staff=True, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if not staff_emails:
        logger.warning("send_low_stock_alert_task: no staff emails to notify")
        return

    send_mail(
        subject=f"[Cartivo] Low stock alert: {product.name}",
        message=(
            f"Stock alert for: {product.name}\n"
            f"SKU: {product.sku}\n"
            f"Current stock: {product.stock}\n"
            f"Threshold: {threshold}\n\n"
            f"Please restock this product soon.\n\n"
            f"— Cartivo"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=staff_emails,
    )
    logger.info(
        "Low-stock alert sent for product %s (stock=%s) to %s",
        product.name, product.stock, staff_emails,
    )
