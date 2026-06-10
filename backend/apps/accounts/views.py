import logging

from django.contrib.auth import get_user_model
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import filters, generics, permissions, serializers as drf_serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AdminUserSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()

logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    """Throttle login attempts per client IP to slow brute-force attacks."""
    scope = "login"


class RegisterRateThrottle(AnonRateThrottle):
    """Throttle account creation per client IP."""
    scope = "register"


class PasswordResetRateThrottle(AnonRateThrottle):
    """Throttle password-reset request/confirm per client IP."""
    scope = "password_reset"


def _set_token_cookie(response, key, token, max_age):
    response.set_cookie(
        key,
        str(token),
        max_age=max_age,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


def set_auth_cookies(response, access=None, refresh=None):
    """Attach httpOnly access/refresh JWT cookies to a response."""
    if access is not None:
        _set_token_cookie(
            response,
            settings.AUTH_COOKIE,
            access,
            int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        )
    if refresh is not None:
        _set_token_cookie(
            response,
            settings.AUTH_REFRESH_COOKIE,
            refresh,
            int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        )


@extend_schema(
    tags=["auth"],
    summary="Register a new account",
)
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]


@extend_schema(tags=["auth"])
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema_view(
    list=extend_schema(tags=["admin"], summary="List users"),
    retrieve=extend_schema(tags=["admin"], summary="Get user"),
    create=extend_schema(tags=["admin"], summary="Create user"),
    update=extend_schema(tags=["admin"], summary="Update user"),
    partial_update=extend_schema(tags=["admin"], summary="Partial update user"),
    destroy=extend_schema(tags=["admin"], summary="Delete user"),
)
class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin-only account management: list, inspect, update flags, delete.

    Restricted to staff users. Guard rails prevent an admin from locking
    themselves out (deactivating/demoting/deleting their own account) and stop
    non-superusers from modifying superuser accounts.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("date_joined", "username", "last_login")

    def _assert_target_modifiable(self, target):
        # Only superusers may modify or delete other superusers.
        if target.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied(
                "Only a superuser can modify a superuser account."
            )

    def perform_update(self, serializer):
        target = serializer.instance
        self._assert_target_modifiable(target)
        # Block self-lockout: an admin can't deactivate or demote themselves
        # through this endpoint (they'd lose access mid-request).
        if target.pk == self.request.user.pk:
            new_is_active = serializer.validated_data.get("is_active", target.is_active)
            new_is_staff = serializer.validated_data.get("is_staff", target.is_staff)
            if not new_is_active or not new_is_staff:
                raise ValidationError(
                    "You cannot deactivate or remove admin access from your own account."
                )
        serializer.save()

    def perform_destroy(self, instance):
        self._assert_target_modifiable(instance)
        if instance.pk == self.request.user.pk:
            raise ValidationError("You cannot delete your own account.")
        instance.delete()


@extend_schema(tags=["auth"], summary="Change password")
class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=PasswordChangeSerializer,
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)


@extend_schema(
    tags=["auth"],
    summary="Obtain JWT cookies",
    description="Validates credentials and sets httpOnly `access_token` and `refresh_token` cookies.",
)
class LoginView(APIView):

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=inline_serializer("LoginRequest", fields={
            "username": drf_serializers.CharField(),
            "password": drf_serializers.CharField(),
        }),
        responses={200: inline_serializer("LoginResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        data = serializer.validated_data
        response = Response({"detail": "Login successful."})
        set_auth_cookies(response, access=data["access"], refresh=data["refresh"])
        return response


@extend_schema(
    tags=["auth"],
    summary="Refresh access token",
    description="Issues a new access token from the `refresh_token` cookie, rotating it.",
)
class RefreshView(APIView):
    """Issue a new access token from the refresh cookie, rotating the refresh token."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
    )
    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        if not raw_refresh:
            return Response(
                {"detail": "No refresh token."}, status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            refresh = RefreshToken(raw_refresh)
        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access = refresh.access_token
        new_refresh = None

        # Mirror SimpleJWT's rotation/blacklist behaviour for cookie flow.
        if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS"):
            if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION"):
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()
            new_refresh = refresh

        response = Response({"detail": "Token refreshed."})
        set_auth_cookies(response, access=access, refresh=new_refresh)
        return response


@extend_schema(
    tags=["auth"],
    summary="Logout",
    description="Blacklists the refresh token and clears the auth cookies.",
)
class LogoutView(APIView):
    """Blacklist the refresh token and clear the auth cookies."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
    )
    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except (TokenError, AttributeError):
                pass
        response = Response({"detail": "Logged out."})
        response.delete_cookie(
            settings.AUTH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/"
        )
        response.delete_cookie(
            settings.AUTH_REFRESH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/"
        )
        return response


@extend_schema(
    tags=["auth"],
    summary="Bootstrap CSRF cookie",
    description="Sets the `csrftoken` cookie so the SPA can include it on unsafe requests.",
)
@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    """Bootstrap endpoint: sets the csrftoken cookie so the SPA can read it."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
    )
    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


@extend_schema(
    tags=["auth"],
    summary="Request password reset email",
    description="Sends a reset link to the given email if an account exists. Always returns 200 to avoid email enumeration.",
)
class PasswordResetRequestView(APIView):
    """Send a password reset link to the user's email."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetRateThrottle]

    @extend_schema(
        request=inline_serializer("PasswordResetRequestBody", fields={"email": drf_serializers.EmailField()}),
        responses={200: inline_serializer("PasswordResetRequestResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        email = request.data.get("email", "").strip()
        # Always return the same 200 to avoid leaking whether an email exists.
        generic_response = Response(
            {"detail": "If that email exists, a reset link has been sent."}
        )

        # Skip blank input: email is optional on the User model, so a blank
        # query would otherwise match every account with no email set.
        if not email:
            return generic_response
        try:
            validate_email(email)
        except DjangoValidationError:
            return generic_response

        frontend_base = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else "http://localhost:3000"

        # Email isn't unique, so send a link to every matching account (each
        # tied to its own user/token) instead of an arbitrary first() match.
        for user in User.objects.filter(email__iexact=email):
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{frontend_base}/reset-password?uid={uid}&token={token}"
            try:
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
            except Exception:
                logger.exception("Failed to send password reset email to user %s", user.pk)
        return generic_response


@extend_schema(
    tags=["auth"],
    summary="Confirm password reset",
    description="Validates the uid/token pair and sets the new password.",
)
class PasswordResetConfirmView(APIView):
    """Validate the reset token and set a new password."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetRateThrottle]

    @extend_schema(
        request=inline_serializer("PasswordResetConfirmBody", fields={
            "uid": drf_serializers.CharField(),
            "token": drf_serializers.CharField(),
            "new_password": drf_serializers.CharField(),
        }),
        responses={200: inline_serializer("PasswordResetConfirmResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not all([uid, token, new_password]):
            return Response({"detail": "uid, token and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Invalid link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successful."})
