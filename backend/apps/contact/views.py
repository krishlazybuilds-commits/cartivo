import datetime
import logging
import os
import re

from django.core.validators import validate_email
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework import status

from apps.accounts.email_utils import normalize_email, is_disposable_email
from apps.accounts.authentication import enforce_csrf
from apps.orders.email_utils import send_html_email
from .constants import MAX_NAME, MAX_EMAIL, MAX_MESSAGE
from .models import NewsletterSubscriber

logger = logging.getLogger(__name__)

# Characters allowed in the contact-form name when used in the email subject.
# Strips anything that could be used for header injection (newlines, null bytes,
# colons, angle brackets, @, semicolons, tabs, etc.).
_SAFE_NAME_RE = re.compile(r"[^\w\s'.\-]")
_DANGEROUS_WS_RE = re.compile(r"[\r\n\f\v\t\x00]+")


def _sanitize_name(raw: str) -> str:
    """Strip characters unsafe for use in email headers, then collapse whitespace."""
    s = _DANGEROUS_WS_RE.sub(" ", raw)
    s = _SAFE_NAME_RE.sub("", s)
    return s.strip()


class ContactRateThrottle(AnonRateThrottle):
    """Throttle contact form and newsletter requests per client IP."""

    scope = "contact"


@extend_schema(
    tags=["contact"],
    summary="Send a contact message",
    description=(
        "Sends a contact message to the site administrators. " "Rate-limited to 5/hour per IP."
    ),
    request=inline_serializer(
        name="ContactRequest",
        fields={
            "name": drf_serializers.CharField(),
            "email": drf_serializers.EmailField(),
            "message": drf_serializers.CharField(),
        },
    ),
    responses={
        200: inline_serializer(
            name="ContactResponse",
            fields={"detail": drf_serializers.CharField()},
        )
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def contact(request):
    """Send a contact message to the site administrators."""
    enforce_csrf(request)
    name = _sanitize_name(request.data.get("name", ""))
    email = normalize_email(request.data.get("email", "").strip())
    message = request.data.get("message", "").strip()

    if not all([name, email, message]):
        return Response({"detail": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(name) > MAX_NAME or len(email) > MAX_EMAIL or len(message) > MAX_MESSAGE:
        return Response(
            {"detail": "One or more fields exceed the allowed length."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if is_disposable_email(email):
        return Response(
            {"detail": "Disposable email addresses are not allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_email(email)
    except ValidationError:
        return Response(
            {"detail": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST
        )

    text_body = f"From: {name} <{email}>\n\n{message}"
    try:
        send_html_email(
            subject=f"[Cartivo Contact] Message from {name}",
            html_template="emails/contact_message.html",
            text_body=text_body,
            recipient_list=[settings.CONTACT_EMAIL],
            context={"name": name, "email": email, "message": message},
        )
    except Exception:
        logger.exception("Failed to send contact email")
        return Response(
            {"detail": "We couldn't send your message right now. Please try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"detail": "Message sent."}, status=status.HTTP_200_OK)


@extend_schema(
    tags=["contact"],
    summary="Subscribe to newsletter",
    request=inline_serializer("NewsletterRequest", fields={"email": drf_serializers.EmailField()}),
    responses={
        200: inline_serializer("NewsletterResponse", fields={"detail": drf_serializers.CharField()})
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def subscribe(request):
    """Subscribe an email address to the newsletter."""
    enforce_csrf(request)
    email = normalize_email(request.data.get("email", "").strip().lower())
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    if is_disposable_email(email):
        return Response(
            {"detail": "Disposable email addresses are not allowed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_email(email)
    except ValidationError:
        return Response(
            {"detail": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST
        )

    # get_or_create is idempotent — re-subscribing the same address is a no-op.
    subscriber, created = NewsletterSubscriber.objects.get_or_create(email=email)
    if not created:
        return Response({"detail": "You're already subscribed."})

    site_url = os.getenv("NEXT_PUBLIC_SITE_URL", "https://cartivo.com") or "https://cartivo.com"
    # Unsubscribe link goes through the frontend proxy
    unsubscribe_url = f"{site_url}/api/v1/newsletter/unsubscribe/{subscriber.unsubscribe_token}/"
    try:
        send_html_email(
            subject="Welcome to Cartivo — you're subscribed!",
            html_template="emails/newsletter_welcome.html",
            text_body=(
                "Welcome to Cartivo!\n\n"
                "You'll receive early access to new arrivals, exclusive deals, and curated picks. "
                "No spam, ever. Unsubscribe anytime.\n\n"
                f"Browse the store: {site_url}\n"
                f"Unsubscribe: {unsubscribe_url}"
            ),
            recipient_list=[email],
            context={
                "site_url": site_url,
                "unsubscribe_url": unsubscribe_url,
                "year": datetime.date.today().year,
            },
        )
    except Exception:
        logger.exception("Failed to send newsletter welcome email to %s", email)

    return Response({"detail": "Subscribed!"}, status=status.HTTP_201_CREATED)


def unsubscribe(request, token):
    """One-click unsubscribe via token link from email."""
    subscriber = get_object_or_404(NewsletterSubscriber, unsubscribe_token=token)
    email = subscriber.email
    subscriber.delete()
    logger.info("Unsubscribed %s", email)

    site_url = os.getenv("NEXT_PUBLIC_SITE_URL", "https://cartivo.com") or "https://cartivo.com"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unsubscribed — Cartivo</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }}
  .card {{
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: 48px 40px;
    max-width: 480px;
    width: 100%;
    text-align: center;
  }}
  .icon {{
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #f0fdf4;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }}
  .icon svg {{ width: 28px; height: 28px; color: #16a34a; }}
  h1 {{ font-size: 22px; color: #14213d; margin-bottom: 12px; font-weight: 700; }}
  p {{ font-size: 15px; color: #666; line-height: 1.6; margin-bottom: 8px; }}
  .email {{ color: #14213d; font-weight: 600; }}
  .btn {{
    display: inline-block;
    margin-top: 24px;
    padding: 12px 28px;
    background: #14213d;
    color: #fff;
    text-decoration: none;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 600;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }}
  .btn:hover {{ transform: translateY(-2px); box-shadow: 0 6px 20px rgba(20,33,61,0.25); }}
</style>
</head>
<body>
<div class="card">
  <div class="icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  </div>
  <h1>You've been unsubscribed</h1>
  <p><span class="email">{email}</span> has been removed from our mailing list.</p>
  <p>You won't receive any more emails from Cartivo. If this was a mistake, you can always re-subscribe on our site.</p>
  <a class="btn" href="{site_url}">Back to Cartivo</a>
</div>
</body>
</html>"""
    return HttpResponse(html)
