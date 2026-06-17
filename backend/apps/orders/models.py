import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.models import Product


class Coupon(models.Model):
    """Discount coupon that can be applied at checkout."""

    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percentage"
        FLAT = "flat", "Flat amount"

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(
        max_length=10, choices=DiscountType.choices, default=DiscountType.PERCENT
    )
    # For percent: value between 1–100. For flat: dollar amount.
    value = models.DecimalField(max_digits=10, decimal_places=2)
    # Minimum cart subtotal required to use this coupon (0 = no minimum).
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Maximum number of times this coupon can be used (0 = unlimited).
    max_uses = models.PositiveIntegerField(default=0)
    times_used = models.PositiveIntegerField(default=0)
    # Null = never expires.
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(value__gt=0),
                name="coupon_value_positive",
            ),
            models.CheckConstraint(
                check=models.Q(min_order_amount__gte=0),
                name="coupon_min_order_non_negative",
            ),
        ]

    def is_valid(self, subtotal: Decimal) -> tuple[bool, str]:
        """Check if this coupon can be applied to an order with the given subtotal.

        Returns (True, "") on success or (False, reason) on failure.
        """
        if not self.is_active:
            return False, "This coupon is no longer active."
        now = timezone.now()
        if now < self.valid_from:
            return False, "This coupon is not yet valid."
        if self.valid_until and now > self.valid_until:
            return False, "This coupon has expired."
        if self.max_uses and self.times_used >= self.max_uses:
            return False, "This coupon has reached its usage limit."
        if subtotal < self.min_order_amount:
            return False, f"Minimum order of ${self.min_order_amount:.2f} required."
        return True, ""

    def calculate_discount(self, subtotal: Decimal) -> Decimal:
        """Return the discount amount for the given subtotal."""
        if self.discount_type == self.DiscountType.PERCENT:
            discount = subtotal * (self.value / Decimal("100"))
        else:
            discount = min(self.value, subtotal)
        return discount.quantize(Decimal("0.01"))

    def __str__(self) -> str:
        if self.discount_type == self.DiscountType.PERCENT:
            return f"{self.code} ({self.value}% off)"
        return f"{self.code} (${self.value} off)"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    # Opaque, non-sequential identifier for external use (emails, URLs, APIs).
    # Avoids leaking order volume or being enumerable like a sequential PK.
    order_number = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )
    # For guest orders (user is null). Captured at checkout so we can send
    # order confirmation without an account.
    guest_email = models.EmailField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Discount applied via coupon. Stored as a snapshot so the order total is
    # self-contained even if the coupon is later modified or deleted.
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    warehouse = models.ForeignKey(
        "catalog.Warehouse",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )

    # Shipping snapshot
    shipping_full_name = models.CharField(max_length=200)
    shipping_address = models.CharField(max_length=255)
    shipping_city = models.CharField(max_length=120)
    shipping_postal_code = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=120)

    # Stripe correlation IDs, captured during checkout so webhook events
    # (expired/refunded) can be matched back to the order.
    stripe_session_id = models.CharField(max_length=255, blank=True, default="")
    stripe_payment_intent = models.CharField(
        max_length=255, blank=True, default="", db_index=True
    )
    # Customer-submitted refund request reason. Non-empty signals a pending request.
    refund_request_reason = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(total__gte=0),
                name="order_total_non_negative",
            ),
        ]

    def recalculate_total(self):
        subtotal = sum((item.subtotal for item in self.items.all()), start=Decimal("0"))
        self.total = max(subtotal - self.discount + self.shipping_cost + self.tax_amount, Decimal("0"))
        return self.total

    def restock(self):
        """Return this order's items to inventory (atomic, race-free)."""
        from apps.catalog.models import Product, WarehouseStock
        from django.db.models import F

        if self.warehouse_id:
            for item in self.items.all():
                wh_stock, created = WarehouseStock.objects.get_or_create(
                    warehouse_id=self.warehouse_id,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    defaults={"stock": 0}
                )
                wh_stock.stock = F("stock") + item.quantity
                wh_stock.save(update_fields=["stock"])
        else:
            for item in self.items.select_related("product"):
                if item.variant_id:
                    from apps.catalog.models import ProductVariant
                    ProductVariant.objects.filter(pk=item.variant_id).update(
                        stock=F("stock") + item.quantity
                    )
                    Product.objects.filter(pk=item.product_id).update(
                        stock=F("stock") + item.quantity
                    )
                else:
                    Product.objects.filter(pk=item.product_id).update(
                        stock=F("stock") + item.quantity
                    )

    def __str__(self) -> str:
        who = str(self.user) if self.user_id else (self.guest_email or "guest")
        return f"Order {self.order_number_short} ({who})"

    @property
    def order_number_short(self):
        """First 8 chars of the UUID — short enough for display, unique enough in practice."""
        return str(self.order_number)[:8].upper()


class StripeEvent(models.Model):
    """Records processed Stripe webhook event IDs to guarantee idempotency.

    Stripe delivers each event at least once and retries delivery whenever the
    endpoint responds with a non-2xx status, so the same event can arrive more
    than once. The unique ``event_id`` lets the webhook detect and skip an
    event it has already handled, preventing duplicate side effects (e.g.
    re-sending the payment confirmation email).
    """

    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event_type} ({self.event_id})"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant",
        on_delete=models.PROTECT,
        related_name="order_items",
        null=True,
        blank=True,
    )
    # Price snapshot at purchase time so historical orders stay accurate.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("order", "product", "variant")
        constraints = [
            models.CheckConstraint(
                check=models.Q(quantity__gte=1),
                name="orderitem_quantity_positive",
            ),
        ]

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self) -> str:
        return f"{self.quantity} x {self.product.name} (Order #{self.order_id})"
