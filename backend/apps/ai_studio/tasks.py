import logging
import time

from celery import shared_task
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Maximum time (seconds) to poll for video generation
VIDEO_POLL_TIMEOUT = 300
VIDEO_POLL_INTERVAL = 10


@shared_task(bind=True, max_retries=1)
def generate_image_task(self, media_id: str):
    """Generate an image using Google Gemini Nano Banana 2."""
    from .models import GeneratedMedia

    try:
        media = GeneratedMedia.objects.get(id=media_id)
        media.status = GeneratedMedia.Status.PROCESSING
        media.save(update_fields=["status"])

        from google import genai
        from google.genai import types
        import os

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

        model = media.model_name or "gemini-2.5-flash-preview-image"

        response = client.models.generate_content(
            model=model,
            contents=media.prompt,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        # Extract image from response
        image_data = None
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                image_data = part.inline_data.data
                break

        if not image_data:
            media.status = GeneratedMedia.Status.FAILED
            media.error_message = "No image was returned by the model."
            media.save(update_fields=["status", "error_message"])
            return

        ext = "png"
        if hasattr(part.inline_data, "mime_type"):
            mime = part.inline_data.mime_type
            if "jpeg" in mime or "jpg" in mime:
                ext = "jpg"
            elif "webp" in mime:
                ext = "webp"

        filename = f"ai-studio-{media.id}.{ext}"
        media.file.save(filename, ContentFile(image_data), save=False)
        media.status = GeneratedMedia.Status.COMPLETED
        media.save(update_fields=["status", "file"])

    except GeneratedMedia.DoesNotExist:
        logger.error("GeneratedMedia %s not found", media_id)
    except Exception as exc:
        logger.exception("Image generation failed for %s", media_id)
        try:
            media = GeneratedMedia.objects.get(id=media_id)
            media.status = GeneratedMedia.Status.FAILED
            media.error_message = str(exc)[:1000]
            media.save(update_fields=["status", "error_message"])
        except GeneratedMedia.DoesNotExist:
            pass
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1)
def generate_video_task(self, media_id: str):
    """Generate a video using Google Gemini Veo 3.1."""
    from .models import GeneratedMedia

    try:
        media = GeneratedMedia.objects.get(id=media_id)
        media.status = GeneratedMedia.Status.PROCESSING
        media.save(update_fields=["status"])

        from google import genai
        from google.genai import types
        import os

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

        model = media.model_name or "veo-3.1-generate-preview"

        # Map aspect ratio to Veo format
        aspect = media.aspect_ratio
        if aspect in ("4:3", "3:4"):
            aspect = "16:9"  # Veo only supports 16:9 and 9:16

        operation = client.models.generate_videos(
            model=model,
            prompt=media.prompt,
            config=types.GenerateVideosConfig(
                person_generation="allow_adult",
                aspect_ratio=aspect,
            ),
        )

        # Poll until done
        elapsed = 0
        while not operation.done:
            if elapsed >= VIDEO_POLL_TIMEOUT:
                media.status = GeneratedMedia.Status.FAILED
                media.error_message = "Video generation timed out."
                media.save(update_fields=["status", "error_message"])
                return
            time.sleep(VIDEO_POLL_INTERVAL)
            elapsed += VIDEO_POLL_INTERVAL
            operation = client.operations.get(operation)

        # Download the generated video
        generated_video = operation.response.generated_videos[0]
        client.files.download(file=generated_video.video)

        video_bytes = generated_video.video.save_as_bytes()
        filename = f"ai-studio-{media.id}.mp4"
        media.file.save(filename, ContentFile(video_bytes), save=False)
        media.status = GeneratedMedia.Status.COMPLETED
        media.save(update_fields=["status", "file"])

    except GeneratedMedia.DoesNotExist:
        logger.error("GeneratedMedia %s not found", media_id)
    except Exception as exc:
        logger.exception("Video generation failed for %s", media_id)
        try:
            media = GeneratedMedia.objects.get(id=media_id)
            media.status = GeneratedMedia.Status.FAILED
            media.error_message = str(exc)[:1000]
            media.save(update_fields=["status", "error_message"])
        except GeneratedMedia.DoesNotExist:
            pass
        raise self.retry(exc=exc)
