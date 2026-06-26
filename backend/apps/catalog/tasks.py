import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model

from apps.orders.email_utils import send_html_email
from config.constants import RETRY_KWARGS_LIGHT

logger = logging.getLogger(__name__)


@shared_task(**RETRY_KWARGS_LIGHT)
def send_low_stock_alert_task(product_id, variant_id=None):
    """Email all staff users when a product's or variant's stock drops to or below LOW_STOCK_THRESHOLD."""
    from .models import Product, ProductVariant

    threshold = getattr(settings, "LOW_STOCK_THRESHOLD", 5)

    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return

    if variant_id:
        try:
            variant = ProductVariant.objects.get(pk=variant_id, product=product)
        except ProductVariant.DoesNotExist:
            return
        if variant.stock > threshold:
            return
        item_name = f"{product.name} — {variant.name}"
        sku = variant.sku
        current_stock = variant.stock
    else:
        if product.stock > threshold:
            return
        item_name = product.name
        sku = product.sku
        current_stock = product.stock

    User = get_user_model()
    staff_emails = list(
        User.objects.filter(is_staff=True, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if not staff_emails:
        logger.warning("send_low_stock_alert_task: no staff emails to notify")
        return

    text_body = (
        f"Stock alert for: {item_name}\n"
        f"SKU: {sku}\n"
        f"Current stock: {current_stock}\n"
        f"Threshold: {threshold}\n\n"
        f"Please restock this item soon.\n\n"
        f"— Cartivo"
    )
    send_html_email(
        subject=f"[Cartivo] Low stock alert: {item_name}",
        html_template="emails/low_stock_alert.html",
        text_body=text_body,
        recipient_list=staff_emails,
        context={
            "item_name": item_name,
            "sku": sku,
            "current_stock": current_stock,
            "threshold": threshold,
        },
    )
    logger.info(
        "Low-stock alert sent for %s (stock=%s) to %s",
        item_name,
        current_stock,
        staff_emails,
    )
