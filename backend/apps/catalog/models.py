from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from .validators import validate_image_size


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock = models.PositiveIntegerField(default=0)
    sku = models.CharField(max_length=64, unique=True)
    image = models.ImageField(
        upload_to="products/",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    on_sale = models.BooleanField(default=False)
    badge = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_featured"]),
            models.Index(fields=["is_new"]),
            models.Index(fields=["on_sale"]),
            # Storefront browse: filter by category and/or active flag, ordered
            # by newest first (the model's default ordering). The leading
            # column also serves category-only / active-only filters.
            models.Index(fields=["category", "-created_at"]),
            models.Index(fields=["is_active", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(price__gte=0),
                name="product_price_non_negative",
            ),
            models.CheckConstraint(
                check=models.Q(stock__gte=0),
                name="product_stock_non_negative",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def in_stock(self) -> bool:
        return self.stock > 0

    @property
    def effective_price(self):
        if self.on_sale and self.sale_price is not None:
            return self.sale_price
        return self.price

    @property
    def display_badge(self):
        if self.badge:
            return self.badge
        if self.is_new:
            return "New"
        if self.on_sale:
            return "Sale"
        return None

    def __str__(self) -> str:
        return self.name


class ProductImage(models.Model):
    """Additional images for a product gallery."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(
        upload_to="products/",
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )
    alt = models.CharField(max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Display order (lower = first)")

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"Image {self.id} for {self.product.name}"


class ProductVariant(models.Model):
    """A specific variant of a product (e.g. Size: L, Color: Red).

    When a product has variants, stock and pricing are managed per-variant.
    The base product's stock field is ignored when variants exist.
    """

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    # Human-readable option combination, e.g. "Large / Red" or "256GB / Black"
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=64, unique=True)
    # Optional price override; if null, the base product price is used.
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(stock__gte=0),
                name="variant_stock_non_negative",
            ),
        ]

    @property
    def effective_price(self):
        return self.price if self.price is not None else self.product.price

    @property
    def in_stock(self) -> bool:
        return self.stock > 0

    def __str__(self) -> str:
        return f"{self.product.name} — {self.name}"


class Review(models.Model):
    """Product review with a 1–5 star rating.

    Each user may leave only one review per product (enforced by unique_together
    and a CheckConstraint). Reviews go through a moderation workflow: new reviews
    are PENDING until approved by staff.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("product", "user")
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__gte=1, rating__lte=5),
                name="review_rating_1_to_5",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rating}★ by {self.user} on {self.product.name}"


class WishlistItem(models.Model):
    """A product saved to a user's wishlist for later purchase."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="wishlisted_by",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")
        ordering = ["-added_at"]

    def __str__(self) -> str:
        return f"{self.user} ♡ {self.product.name}"


def update_cached_stock(product_id, variant_id=None):
    """Update cached stock values on Product and/or ProductVariant."""
    from django.db.models import Sum

    if variant_id:
        # Sum stock across all active warehouses for this variant
        total_stock = WarehouseStock.objects.filter(
            variant_id=variant_id,
            warehouse__is_active=True
        ).aggregate(total=Sum("stock"))["total"] or 0
        
        # Update variant's stock
        ProductVariant.objects.filter(id=variant_id).update(stock=total_stock)
        
        # Also update the base product's stock (sum of all its active variants' stocks)
        total_product_stock = ProductVariant.objects.filter(
            product_id=product_id,
            is_active=True
        ).aggregate(total=Sum("stock"))["total"] or 0
        Product.objects.filter(id=product_id).update(stock=total_product_stock)
    else:
        # Sum stock across all active warehouses for this product
        total_stock = WarehouseStock.objects.filter(
            product_id=product_id,
            variant__isnull=True,
            warehouse__is_active=True
        ).aggregate(total=Sum("stock"))["total"] or 0
        Product.objects.filter(id=product_id).update(stock=total_stock)


class Warehouse(models.Model):
    """An inventory warehouse or fulfillment center."""

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class WarehouseStock(models.Model):
    """Stock level of a Product or ProductVariant in a specific Warehouse."""

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="stocks",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="warehouse_stocks",
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name="warehouse_stocks",
        null=True,
        blank=True,
    )
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["warehouse", "product", "variant"]
        constraints = [
            models.UniqueConstraint(
                fields=["warehouse", "product"],
                condition=models.Q(variant__isnull=True),
                name="unique_warehouse_product_stock",
            ),
            models.UniqueConstraint(
                fields=["warehouse", "variant"],
                condition=models.Q(variant__isnull=False),
                name="unique_warehouse_variant_stock",
            ),
            models.CheckConstraint(
                check=models.Q(stock__gte=0),
                name="warehouse_stock_non_negative",
            ),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.update_cached_stock()

    def delete(self, *args, **kwargs):
        product_id = self.product_id
        variant_id = self.variant_id
        super().delete(*args, **kwargs)
        update_cached_stock(product_id, variant_id)

    def update_cached_stock(self):
        update_cached_stock(self.product_id, self.variant_id)

    def __str__(self) -> str:
        item = self.variant if self.variant else self.product
        return f"{item} in {self.warehouse.name}: {self.stock}"

