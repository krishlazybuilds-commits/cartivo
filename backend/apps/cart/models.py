from django.conf import settings
from django.db import models

from apps.catalog.models import Product, ProductVariant


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    abandoned_email_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def total(self):
        return sum((item.subtotal for item in self.items.all()), start=0)

    @property
    def item_count(self) -> int:
        return sum(item.quantity for item in self.items.all())

    def __str__(self) -> str:
        return f"Cart({self.user})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="cart_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # A cart can hold the same product with different variants as separate lines.
        unique_together = ("cart", "product", "variant")
        ordering = ["-added_at"]

    @property
    def unit_price(self):
        if self.variant:
            return self.variant.effective_price
        return self.product.price

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.cart.abandoned_email_sent:
            self.cart.abandoned_email_sent = False
            self.cart.save(update_fields=["abandoned_email_sent"])

    def __str__(self) -> str:
        suffix = f" ({self.variant.name})" if self.variant_id else ""
        return f"{self.quantity} x {self.product.name}{suffix}"
