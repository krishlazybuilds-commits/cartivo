import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Product


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
        self.total = sum((item.subtotal for item in self.items.all()), start=0)
        return self.total

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
    # Price snapshot at purchase time so historical orders stay accurate.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("order", "product")
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
