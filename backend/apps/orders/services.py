import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F

from apps.catalog.models import Product, ProductVariant
from apps.catalog.tasks import send_low_stock_alert_task
from .models import Coupon, Order, OrderItem
from .serializers import calculate_estimate

logger = logging.getLogger(__name__)


class CheckoutError(Exception):
    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code


def resolve_coupon(coupon_code):
    code = (coupon_code or "").strip()
    if not code:
        return None
    try:
        return Coupon.objects.get(code__iexact=code)
    except Coupon.DoesNotExist:
        raise CheckoutError("Invalid coupon code.")


def create_order_and_items(*, order_kwargs, items, coupon=None):
    """Atomically create order + items, manage stock, apply coupon.
    Raises CheckoutError on validation failure.
    """
    product_ids = [i["product_id"] for i in items]
    variant_ids = [i["variant_id"] for i in items if i.get("variant_id")]

    with transaction.atomic():
        locked_products = {
            p.id: p
            for p in Product.objects.select_for_update().filter(id__in=product_ids)
        }
        locked_variants = {}
        if variant_ids:
            locked_variants = {
                v.id: v
                for v in ProductVariant.objects.select_for_update().filter(id__in=variant_ids)
            }

        for item in items:
            pid = item["product_id"]
            qty = item["quantity"]
            product = locked_products.get(pid)
            if not product:
                raise CheckoutError("Product not found.")
            if not product.is_active:
                raise CheckoutError(f"'{product.name}' is no longer available.")

            variant_id = item.get("variant_id")
            if variant_id:
                variant = locked_variants.get(variant_id)
                if not variant:
                    raise CheckoutError("Variant not found.")
                if qty > variant.stock:
                    raise CheckoutError(
                        f"Insufficient stock for '{product.name} — {variant.name}'. "
                        f"Available: {variant.stock}.",
                    )
            else:
                if qty > product.stock:
                    raise CheckoutError(
                        f"Insufficient stock for '{product.name}'. Available: {product.stock}.",
                    )

        order = Order.objects.create(**order_kwargs)

        threshold = getattr(settings, "LOW_STOCK_THRESHOLD", 5)
        low_stock_product_ids = []
        order_items = []

        for item in items:
            pid = item["product_id"]
            qty = item["quantity"]
            product = locked_products[pid]
            variant_id = item.get("variant_id")

            if variant_id:
                variant = locked_variants[variant_id]
                remaining = variant.stock - qty
                variant.stock = F("stock") - qty
                variant.save(update_fields=["stock"])
                unit_price = variant.effective_price
            else:
                remaining = product.stock - qty
                product.stock = F("stock") - qty
                product.save(update_fields=["stock"])
                unit_price = product.price

            if remaining <= threshold:
                low_stock_product_ids.append(pid)

            order_items.append(OrderItem(
                order=order,
                product=product,
                unit_price=unit_price,
                quantity=qty,
            ))

        OrderItem.objects.bulk_create(order_items)

        for pid in low_stock_product_ids:
            transaction.on_commit(lambda p=pid: send_low_stock_alert_task.delay(p))

        subtotal = sum(
            (i.unit_price * i.quantity for i in order_items), Decimal("0")
        )
        estimate = calculate_estimate(order.shipping_country, float(subtotal))
        order.shipping_cost = Decimal(str(estimate["shipping"]))
        order.tax_amount = Decimal(str(estimate["tax"]))

        if coupon:
            valid, reason = coupon.is_valid(subtotal)
            if not valid:
                transaction.set_rollback(True)
                raise CheckoutError(reason)
            order.discount = coupon.calculate_discount(subtotal)
            order.coupon = coupon
            coupon.times_used = F("times_used") + 1
            coupon.save(update_fields=["times_used"])

        order.recalculate_total()
        order.save(
            update_fields=[
                "total", "discount", "coupon", "shipping_cost", "tax_amount",
            ]
        )

    return order, order_items


def build_stripe_line_items(order_items, shipping_cost, tax_amount):
    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "unit_amount": int(item.unit_price * 100),
                "product_data": {"name": item.product.name},
            },
            "quantity": item.quantity,
        }
        for item in order_items
    ]
    if shipping_cost > 0:
        line_items.append({
            "price_data": {
                "currency": "usd",
                "unit_amount": int(shipping_cost * 100),
                "product_data": {"name": "Shipping"},
            },
            "quantity": 1,
        })
    if tax_amount > 0:
        line_items.append({
            "price_data": {
                "currency": "usd",
                "unit_amount": int(tax_amount * 100),
                "product_data": {"name": "Tax"},
            },
            "quantity": 1,
        })
    return line_items
