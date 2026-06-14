from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=5,
)
def send_password_reset_email_task(user_id, reset_url):
    try:
        user = User.objects.get(pk=user_id)
        send_mail(
            subject="Reset your Cartivo password",
            message=(
                f"Hi {user.first_name or user.email},\n\n"
                f"Click the link below to reset your password. "
                f"This link expires in 24 hours.\n\n"
                f"{reset_url}\n\n"
                f"If you didn't request this, ignore this email.\n\n"
                f"— The Cartivo Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
    except User.DoesNotExist:
        logger.warning(f"send_password_reset_email_task: user {user_id} not found")
    except Exception:
        logger.exception(f"Failed to send password reset email to user {user_id}")
        raise
