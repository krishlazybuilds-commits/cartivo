from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """User authenticated by username, with optional email and phone."""

    # username, password, first/last name, etc. come from AbstractUser.
    email = models.EmailField("email address", blank=False, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    # Holds a requested new email until the user confirms it via a link.
    pending_email = models.EmailField(blank=True, default="")

    def __str__(self) -> str:
        return self.username


class Address(models.Model):
    """Saved shipping address for faster repeat checkout."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    label = models.CharField(
        max_length=50, blank=True, default="",
        help_text="Optional label, e.g. 'Home', 'Office'.",
    )
    full_name = models.CharField(max_length=200)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=120)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "addresses"
        ordering = ["-is_default", "-created_at"]

    def __str__(self) -> str:
        return f"{self.label or 'Address'} — {self.full_name}, {self.city}"
