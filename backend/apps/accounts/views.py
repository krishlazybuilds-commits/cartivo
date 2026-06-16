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

from .authentication import enforce_csrf
from .email_utils import normalize_email, is_disposable_email
from .models import Address
from .tasks import (
    send_password_reset_email_task,
    send_email_change_task,
    send_verification_email_task,
)
from .serializers import (
    AddressSerializer,
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data.get("email", "")
        if email and User.objects.filter(email__iexact=email).exists():
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        self.perform_create(serializer)
        self._send_verification_email(serializer.instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _send_verification_email(self, user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_base = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else "http://localhost:3000"
        verify_url = f"{frontend_base}/verify-email?uid={uid}&token={token}"
        send_verification_email_task.delay(user.pk, verify_url)


@extend_schema(tags=["auth"])
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    @extend_schema(
        summary="Delete own account",
        request=None,
        responses={204: None},
    )
    def delete(self, request, *args, **kwargs):
        user = request.user
        # Blacklist the current refresh token so existing sessions are invalidated.
        raw_refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except (TokenError, AttributeError):
                pass
        # Deactivate instead of hard-delete to preserve order/review history integrity.
        user.is_active = False
        user.save(update_fields=["is_active"])
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.AUTH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/")
        response.delete_cookie(settings.AUTH_REFRESH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/")
        return response


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
    summary="Sign in with Google",
    description=(
        "Verifies a Google ID token (from Google Identity Services), finds or "
        "creates the matching user, and sets httpOnly `access_token` and "
        "`refresh_token` cookies — same as password login."
    ),
)
class GoogleLoginView(APIView):
    """Exchange a Google ID token for Cartivo auth cookies.

    The frontend obtains an ID token via Google Identity Services and POSTs it
    here as ``{"credential": "<jwt>"}``. We verify the token's signature and
    audience against GOOGLE_OAUTH_CLIENT_ID, then issue our own JWT cookies so
    the rest of the app treats the session identically to a password login.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=inline_serializer("GoogleLoginRequest", fields={
            "credential": drf_serializers.CharField(),
        }),
        responses={200: inline_serializer("GoogleLoginResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        enforce_csrf(request)

        client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
        if not client_id:
            return Response(
                {"detail": "Google sign-in is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        credential = request.data.get("credential", "")
        if not credential:
            return Response(
                {"detail": "Missing Google credential."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Imported lazily so the dependency is only needed when the feature is used.
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), client_id
            )
        except ValueError:
            # Bad signature, wrong audience, expired, or malformed token.
            return Response(
                {"detail": "Invalid Google credential."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = (idinfo.get("email") or "").strip()
        if not email or not idinfo.get("email_verified", False):
            return Response(
                {"detail": "Google account email is missing or unverified."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = self._get_or_create_user(idinfo, email)
        except ValidationError as exc:
            return Response({"detail": exc.detail}, status=status.HTTP_409_CONFLICT)

        if not user.is_active:
            return Response(
                {"detail": "This account is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        response = Response({"detail": "Login successful."})
        set_auth_cookies(response, access=refresh.access_token, refresh=refresh)
        return response

    @staticmethod
    def _get_or_create_user(idinfo, email):
        """Match an existing account by email, or provision a new one.

        Safety rules to prevent account-takeover via pre-registration squatting:

        1. If an account with this email exists and has NO usable password, it
           is a Google-only account — safe to return it directly.
        2. If an account with this email exists and HAS a usable password, we
           refuse to silently merge the sessions.  A ValidationError (HTTP 409)
           is raised so the caller can tell the user to sign in with their
           password and link Google from their profile instead.
        3. If no account exists, a new one is created with an unusable password
           (Google-only sign-in) and a unique username derived from the email
           local part.
        """
        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            if not existing.has_usable_password():
                # Google-only account — safe to reuse.
                return existing
            # Password account exists — block silent takeover.
            raise ValidationError(
                "An account with this email already exists. "
                "Sign in with your password, then link Google from your profile."
            )

        base_username = email.split("@")[0][:140] or "user"
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=idinfo.get("given_name", "")[:150],
            last_name=idinfo.get("family_name", "")[:150],
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        return user


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
        enforce_csrf(request)
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
        enforce_csrf(request)
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
        enforce_csrf(request)
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
            send_password_reset_email_task.delay(user.pk, reset_url)
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


class AddressViewSet(viewsets.ModelViewSet):
    """CRUD for the authenticated user's saved shipping addresses."""

    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # If this is the user's first address, make it default.
        is_first = not Address.objects.filter(user=self.request.user).exists()
        serializer.save(user=self.request.user, is_default=is_first or serializer.validated_data.get("is_default", False))

    def perform_update(self, serializer):
        instance = serializer.save()
        # If marked as default, unset other defaults.
        if instance.is_default:
            Address.objects.filter(user=self.request.user).exclude(pk=instance.pk).update(is_default=False)


@extend_schema(
    tags=["auth"],
    summary="Verify email address",
    description="Validates the uid/token pair and marks the user's email as verified.",
)
class EmailVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=inline_serializer("EmailVerifyBody", fields={
            "uid": drf_serializers.CharField(),
            "token": drf_serializers.CharField(),
        }),
        responses={200: inline_serializer("EmailVerifyResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        if not all([uid, token]):
            return Response({"detail": "uid and token are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Verification link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return Response({"detail": "Email verified successfully."})


@extend_schema(tags=["auth"], summary="Request email change")
class EmailChangeRequestView(APIView):
    """Send a confirmation link to the requested new email address."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=inline_serializer("EmailChangeRequest", fields={"email": drf_serializers.EmailField()}),
        responses={200: inline_serializer("EmailChangeRequestResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        new_email = normalize_email(request.data.get("email", "").strip().lower())
        if not new_email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if is_disposable_email(new_email):
            return Response({"detail": "Disposable email addresses are not allowed."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_email(new_email)
        except DjangoValidationError:
            return Response({"detail": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)

        if new_email == request.user.email.lower():
            return Response({"detail": "That is already your current email."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({"detail": "That email is already in use."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.pending_email = new_email
        request.user.save(update_fields=["pending_email"])

        uid = urlsafe_base64_encode(force_bytes(request.user.pk))
        token = default_token_generator.make_token(request.user)
        frontend_base = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else "http://localhost:3000"
        confirm_url = f"{frontend_base}/profile?email_uid={uid}&email_token={token}"
        send_email_change_task.delay(request.user.pk, confirm_url)
        return Response({"detail": "Confirmation email sent. Check your new inbox."})


@extend_schema(tags=["auth"], summary="Confirm email change")
class EmailChangeConfirmView(APIView):
    """Validate the token and apply the pending email change."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=inline_serializer("EmailChangeConfirmRequest", fields={
            "uid": drf_serializers.CharField(),
            "token": drf_serializers.CharField(),
        }),
        responses={200: inline_serializer("EmailChangeConfirmResponse", fields={"detail": drf_serializers.CharField()})},
    )
    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        if not all([uid, token]):
            return Response({"detail": "uid and token are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Invalid link."}, status=status.HTTP_400_BAD_REQUEST)

        # Only the authenticated user can confirm their own change.
        if user.pk != request.user.pk:
            return Response({"detail": "Invalid link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.pending_email:
            return Response({"detail": "No pending email change."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=user.pending_email).exclude(pk=user.pk).exists():
            user.pending_email = ""
            user.save(update_fields=["pending_email"])
            return Response({"detail": "That email is already in use."}, status=status.HTTP_409_CONFLICT)

        user.email = user.pending_email
        user.pending_email = ""
        user.save(update_fields=["email", "pending_email"])
        return Response({"detail": "Email updated successfully."})


@extend_schema(
    tags=["auth"],
    summary="GDPR data export",
    description="Returns all personal data for the authenticated user in JSON format "
                "(right of access / data portability under Art. 15 & 20 GDPR).",
)
class GDPRExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: {"type": "object"}},
    )
    def get(self, request):
        user = request.user
        from .models import Address
        from orders.models import Order
        from catalog.models import Review, WishlistItem
        from cart.models import Cart
        from contact.models import NewsletterSubscriber

        data = {
            "profile": {
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "date_joined": user.date_joined.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
            "addresses": list(Address.objects.filter(user=user).values(
                "label", "full_name", "address", "city", "postal_code", "country", "is_default"
            )),
            "orders": [],
            "reviews": list(Review.objects.filter(user=user).values(
                "product_id", "rating", "title", "body", "created_at"
            )),
            "wishlist": list(WishlistItem.objects.filter(user=user).values(
                "product_id", "added_at"
            )),
        }

        for order in Order.objects.filter(user=user).prefetch_related("items"):
            data["orders"].append({
                "order_number": str(order.order_number),
                "status": order.status,
                "total": str(order.total),
                "shipping_full_name": order.shipping_full_name,
                "shipping_address": order.shipping_address,
                "shipping_city": order.shipping_city,
                "shipping_postal_code": order.shipping_postal_code,
                "shipping_country": order.shipping_country,
                "discount": str(order.discount),
                "created_at": order.created_at.isoformat(),
                "items": [
                    {"product_id": item.product_id, "unit_price": str(item.unit_price), "quantity": item.quantity}
                    for item in order.items.all()
                ],
            })

        cart = Cart.objects.filter(user=user).first()
        data["cart"] = list(cart.items.values("product_id", "variant_id", "quantity")) if cart else []

        sub = NewsletterSubscriber.objects.filter(email__iexact=user.email).first()
        data["newsletter_subscription"] = {
            "subscribed": sub is not None,
            "subscribed_at": sub.subscribed_at.isoformat() if sub else None,
        }

        return Response(data)


@extend_schema(
    tags=["auth"],
    summary="GDPR account deletion",
    description="Anonymises or deletes all personal data for the authenticated user "
                "(right to erasure under Art. 17 GDPR). Orders are retained for legal "
                "obligations but stripped of personal data. The account is deactivated "
                "and anonymised so it can never be used again.",
)
class GDPRDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: {"type": "object", "properties": {"detail": {"type": "string"}}}},
    )
    def post(self, request):
        user = request.user
        from .models import Address
        from orders.models import Order
        from catalog.models import Review, WishlistItem
        from cart.models import Cart
        from contact.models import NewsletterSubscriber

        # 1. Anonymise orders: detach from user, clear personal fields.
        for order in Order.objects.filter(user=user):
            order.user = None
            order.guest_email = ""
            order.shipping_full_name = "[anonymized]"
            order.shipping_address = "[anonymized]"
            order.shipping_city = "[anonymized]"
            order.shipping_postal_code = "[anonymized]"
            order.shipping_country = "[anonymized]"
            order.save(update_fields=[
                "user", "guest_email", "shipping_full_name", "shipping_address",
                "shipping_city", "shipping_postal_code", "shipping_country",
            ])

        # 2. Delete associated data that can't be anonymised.
        Address.objects.filter(user=user).delete()
        Cart.objects.filter(user=user).delete()
        WishlistItem.objects.filter(user=user).delete()
        Review.objects.filter(user=user).delete()

        # 3. Remove newsletter subscription linked to this email.
        NewsletterSubscriber.objects.filter(email__iexact=user.email).delete()

        # 4. Anonymise the user record so it can never be re-activated.
        user.username = f"deleted-{user.pk}"
        user.email = f"deleted-{user.pk}@cartivo.local"
        user.first_name = ""
        user.last_name = ""
        user.phone = ""
        user.pending_email = ""
        user.set_unusable_password()
        user.is_active = False
        user.save(update_fields=[
            "username", "email", "first_name", "last_name", "phone",
            "pending_email", "password", "is_active",
        ])

        # 5. Invalidate all sessions.
        raw_refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except (TokenError, AttributeError):
                pass

        response = Response({"detail": "Your personal data has been deleted or anonymised."})
        response.delete_cookie(settings.AUTH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/")
        response.delete_cookie(settings.AUTH_REFRESH_COOKIE, domain=settings.AUTH_COOKIE_DOMAIN, path="/")
        return response
