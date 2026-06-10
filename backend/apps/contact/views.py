import logging

from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework import status

logger = logging.getLogger(__name__)

# Reasonable upper bounds to prevent abuse / oversized payloads.
MAX_NAME = 120
MAX_EMAIL = 254
MAX_MESSAGE = 5000


class ContactRateThrottle(AnonRateThrottle):
    """Limit unauthenticated contact submissions per client (see DRF rates)."""
    scope = "contact"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactRateThrottle])
def contact(request):
    name = request.data.get("name", "").strip()
    email = request.data.get("email", "").strip()
    message = request.data.get("message", "").strip()

    if not all([name, email, message]):
        return Response({"detail": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(name) > MAX_NAME or len(email) > MAX_EMAIL or len(message) > MAX_MESSAGE:
        return Response({"detail": "One or more fields exceed the allowed length."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except ValidationError:
        return Response({"detail": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        send_mail(
            subject=f"[Cartivo Contact] Message from {name}",
            message=f"From: {name} <{email}>\n\n{message}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.EMAIL_HOST_USER],
        )
    except Exception:
        # Don't leak SMTP errors to the client or 500 the request.
        logger.exception("Failed to send contact email")
        return Response(
            {"detail": "We couldn't send your message right now. Please try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"detail": "Message sent."}, status=status.HTTP_200_OK)
