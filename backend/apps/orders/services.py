import logging
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
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

    from apps.catalog.models import Warehouse, WarehouseStock

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

        # Select a warehouse that has sufficient stock for all items in the order.
        active_warehouses = Warehouse.objects.filter(is_active=True)
        if not active_warehouses.exists():
            # Self-healing: create default warehouse if none exist (e.g. in tests)
            selected_warehouse = Warehouse.objects.create(
                code="CENTRAL",
                name="Central Warehouse",
                address="100 Main St, Metropolis",
                is_active=True,
            )
        else:
            selected_warehouse = None
            for warehouse in active_warehouses:
                has_sufficient_stock = True
                for item in items:
                    pid = item["product_id"]
                    qty = item["quantity"]
                    vid = item.get("variant_id")

                    stock_query = WarehouseStock.objects.filter(
                        warehouse=warehouse,
                        product_id=pid,
                        variant_id=vid
                    ).first()

                    # Fallback to product/variant stock if WarehouseStock doesn't exist yet
                    if stock_query:
                        warehouse_qty = stock_query.stock
                    else:
                        # Check if any WarehouseStock exists for this product/variant
                        has_any_wh_stock = WarehouseStock.objects.filter(
                            product_id=pid,
                            variant_id=vid
                        ).exists()

                        if not has_any_wh_stock:
                            if vid:
                                variant = locked_variants.get(vid)
                                warehouse_qty = variant.stock if variant else 0
                            else:
                                product = locked_products.get(pid)
                                warehouse_qty = product.stock if product else 0
                        else:
                            warehouse_qty = 0

                    if qty > warehouse_qty:
                        has_sufficient_stock = False
                        break

                if has_sufficient_stock:
                    selected_warehouse = warehouse
                    break

            if not selected_warehouse:
                selected_warehouse = active_warehouses.first()

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
                
                # Lock the stock row during validation so the check and the
                # later decrement observe a consistent value even if the
                # Product-level lock above is ever relaxed.
                wh_stock, created = WarehouseStock.objects.select_for_update().get_or_create(
                    warehouse=selected_warehouse,
                    product_id=pid,
                    variant_id=variant_id,
                    defaults={"stock": variant.stock}
                )
                if qty > wh_stock.stock:
                    raise CheckoutError(
                        f"Insufficient stock for '{product.name} — {variant.name}' in {selected_warehouse.name}. "
                        f"Available: {wh_stock.stock}.",
                    )
            else:
                # Lock the stock row during validation so the check and the
                # later decrement observe a consistent value even if the
                # Product-level lock above is ever relaxed.
                wh_stock, created = WarehouseStock.objects.select_for_update().get_or_create(
                    warehouse=selected_warehouse,
                    product_id=pid,
                    variant_id=None,
                    defaults={"stock": product.stock}
                )
                if qty > wh_stock.stock:
                    raise CheckoutError(
                        f"Insufficient stock for '{product.name}' in {selected_warehouse.name}. "
                        f"Available: {wh_stock.stock}.",
                    )

        order_kwargs.setdefault("currency", getattr(settings, "DEFAULT_CURRENCY", "usd"))
        order_kwargs["warehouse"] = selected_warehouse
        order = Order.objects.create(**order_kwargs)

        threshold = getattr(settings, "LOW_STOCK_THRESHOLD", 5)
        low_stock_alerts = []
        order_items = []

        # The Product rows are already locked (select_for_update at the top),
        # which serializes concurrent checkouts for the same product. The nested
        # savepoint + IntegrityError guard is defense-in-depth: should any
        # decrement ever slip past the row locks and push stock below zero, the
        # warehouse_stock_non_negative CHECK constraint fires. We roll the
        # savepoint back and surface the same clean "insufficient stock" 400 the
        # validation loop returns instead of an unhandled 500.
        try:
            with transaction.atomic():
                for item in items:
                    pid = item["product_id"]
                    qty = item["quantity"]
                    product = locked_products[pid]
                    variant_id = item.get("variant_id")
                    variant = None

                    if variant_id:
                        variant = locked_variants[variant_id]
                        # Lock and update WarehouseStock
                        wh_stock, created = WarehouseStock.objects.select_for_update().get_or_create(
                            warehouse=selected_warehouse,
                            product_id=pid,
                            variant_id=variant_id,
                            defaults={"stock": variant.stock}
                        )
                        wh_stock.stock = F("stock") - qty
                        wh_stock.save(update_fields=["stock"])

                        variant.refresh_from_db()
                        remaining = variant.stock
                        unit_price = variant.effective_price
                    else:
                        # Lock and update WarehouseStock
                        wh_stock, created = WarehouseStock.objects.select_for_update().get_or_create(
                            warehouse=selected_warehouse,
                            product_id=pid,
                            variant_id=None,
                            defaults={"stock": product.stock}
                        )
                        wh_stock.stock = F("stock") - qty
                        wh_stock.save(update_fields=["stock"])

                        product.refresh_from_db()
                        remaining = product.stock
                        unit_price = product.price

                    if remaining <= threshold:
                        low_stock_alerts.append((pid, variant_id))

                    order_items.append(OrderItem(
                        order=order,
                        product=product,
                        variant=variant,
                        unit_price=unit_price,
                        quantity=qty,
                    ))

                OrderItem.objects.bulk_create(order_items)
        except IntegrityError:
            raise CheckoutError(
                "Insufficient stock for one or more items. Please review your cart and try again."
            )

        for pid, vid in low_stock_alerts:
            transaction.on_commit(
                lambda p=pid, v=vid: send_low_stock_alert_task.delay(p, variant_id=v)
            )

        subtotal = sum(
            (i.unit_price * i.quantity for i in order_items), Decimal("0")
        )
        estimate = calculate_estimate(order.shipping_country, float(subtotal))
        order.shipping_cost = Decimal(str(estimate["shipping"]))
        order.tax_amount = Decimal(str(estimate["tax"]))

        if coupon:
            # Lock the coupon row so concurrent checkouts can't both pass the
            # max_uses check before either increments times_used.
            coupon = Coupon.objects.select_for_update().get(pk=coupon.pk)
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
    currency = settings.DEFAULT_CURRENCY
    line_items = [
        {
            "price_data": {
                "currency": currency,
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
                "currency": currency,
                "unit_amount": int(shipping_cost * 100),
                "product_data": {"name": "Shipping"},
            },
            "quantity": 1,
        })
    if tax_amount > 0:
        line_items.append({
            "price_data": {
                "currency": currency,
                "unit_amount": int(tax_amount * 100),
                "product_data": {"name": "Tax"},
            },
            "quantity": 1,
        })
    return line_items
