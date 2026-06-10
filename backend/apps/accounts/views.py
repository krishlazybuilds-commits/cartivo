from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import PasswordChangeSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


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


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)


class LoginView(APIView):
    """Validate credentials and set httpOnly JWT cookies."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

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


class RefreshView(APIView):
    """Issue a new access token from the refresh cookie, rotating the refresh token."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

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


class LogoutView(APIView):
    """Blacklist the refresh token and clear the auth cookies."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

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


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    """Bootstrap endpoint: sets the csrftoken cookie so the SPA can read it."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})
