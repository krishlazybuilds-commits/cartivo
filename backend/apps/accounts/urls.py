from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AddressViewSet,
    AdminUserViewSet,
    ChangePasswordView,
    CSRFView,
    EmailChangeConfirmView,
    EmailChangeRequestView,
    EmailVerifyView,
    GDPRDeleteView,
    GDPRExportView,
    GoogleLoginView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
    ValidateView,
)

app_name = "accounts"

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-user")
router.register("addresses", AddressViewSet, basename="address")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify/", EmailVerifyView.as_view(), name="email_verify"),
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", ChangePasswordView.as_view(), name="change_password"),
    path("me/export/", GDPRExportView.as_view(), name="gdpr_export"),
    path("me/gdpr-delete/", GDPRDeleteView.as_view(), name="gdpr_delete"),
    path("me/email/", EmailChangeRequestView.as_view(), name="email_change_request"),
    path("me/email/confirm/", EmailChangeConfirmView.as_view(), name="email_change_confirm"),
    path("csrf/", CSRFView.as_view(), name="csrf"),
    path("token/", LoginView.as_view(), name="token_obtain_pair"),
    path("google/", GoogleLoginView.as_view(), name="google_login"),
    path("token/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("validate/", ValidateView.as_view(), name="validate"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"
    ),
] + router.urls
