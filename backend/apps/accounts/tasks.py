from celery import shared_task
from django.contrib.auth import get_user_model
import logging

from apps.orders.email_utils import send_html_email
from config.constants import RETRY_KWARGS

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task(**RETRY_KWARGS)
def send_password_reset_email_task(user_id, reset_url):
    try:
        user = User.objects.get(pk=user_id)
        name = user.first_name or user.email
        text_body = (
            f"Hi {name},\n\n"
            f"Click the link below to reset your password. "
            f"This link expires in 24 hours.\n\n"
            f"{reset_url}\n\n"
            f"If you didn't request this, ignore this email.\n\n"
            f"— The Cartivo Team"
        )
        send_html_email(
            subject="Reset your Cartivo password",
            html_template="emails/password_reset.html",
            text_body=text_body,
            recipient_list=[user.email],
            context={"name": name, "reset_url": reset_url},
        )
    except User.DoesNotExist:
        logger.warning(f"send_password_reset_email_task: user {user_id} not found")
    except Exception:
        logger.exception(f"Failed to send password reset email to user {user_id}")
        raise


@shared_task(**RETRY_KWARGS)
def send_verification_email_task(user_id, verify_url):
    try:
        user = User.objects.get(pk=user_id)
        name = user.first_name or user.email
        text_body = (
            f"Hi {name},\n\n"
            f"Click the link below to verify your email address.\n\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours. "
            f"If you didn't create an account, ignore this email.\n\n"
            f"— The Cartivo Team"
        )
        send_html_email(
            subject="Verify your Cartivo email address",
            html_template="emails/email_verification.html",
            text_body=text_body,
            recipient_list=[user.email],
            context={"name": name, "verify_url": verify_url},
        )
    except User.DoesNotExist:
        logger.warning(f"send_verification_email_task: user {user_id} not found")
    except Exception:
        logger.exception(f"Failed to send verification email to user {user_id}")
        raise


@shared_task(**RETRY_KWARGS)
def send_email_change_task(user_id, confirm_url):
    try:
        user = User.objects.get(pk=user_id)
        if not user.pending_email:
            return
        name = user.first_name or user.username
        text_body = (
            f"Hi {name},\n\n"
            f"Click the link below to confirm your new email address.\n\n"
            f"{confirm_url}\n\n"
            f"This link expires in 24 hours. If you didn't request this, ignore this email.\n\n"
            f"— The Cartivo Team"
        )
        send_html_email(
            subject="Confirm your new Cartivo email address",
            html_template="emails/email_change.html",
            text_body=text_body,
            recipient_list=[user.pending_email],
            context={"name": name, "confirm_url": confirm_url},
        )
    except User.DoesNotExist:
        logger.warning(f"send_email_change_task: user {user_id} not found")
    except Exception:
        logger.exception(f"Failed to send email change confirmation to user {user_id}")
        raise
