import uuid

from django.db import models


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)
    unsubscribe_token = models.UUIDField(null=True, blank=True, unique=True)

    def save(self, *args, **kwargs):
        if not self.unsubscribe_token:
            self.unsubscribe_token = uuid.uuid4()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email
