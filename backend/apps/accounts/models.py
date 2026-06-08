from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """User authenticated by username, with optional email and phone."""

    # username, password, first/last name, etc. come from AbstractUser.
    email = models.EmailField("email address", blank=True)
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self) -> str:
        return self.username
