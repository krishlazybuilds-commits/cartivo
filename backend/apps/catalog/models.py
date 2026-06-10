from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils.text import slugify

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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["is_active"]),
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

    def __str__(self) -> str:
        return self.name


class Review(models.Model):
    """Product review with a 1–5 star rating.

    Each user may leave only one review per product (enforced by unique_together
    and a CheckConstraint). Reviews are public and displayed on product pages as
    social proof.
    """

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
