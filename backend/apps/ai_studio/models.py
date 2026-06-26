import uuid

from django.conf import settings
from django.db import models


class GeneratedMedia(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    prompt = models.TextField()
    model_name = models.CharField(max_length=80)
    file = models.FileField(upload_to="ai-studio/", blank=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING
    )
    task_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    aspect_ratio = models.CharField(max_length=10, default="1:1")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="generated_media",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "generated media"
        verbose_name_plural = "generated media"

    def __str__(self):
        return f"{self.get_media_type_display()} — {self.prompt[:50]}…"
