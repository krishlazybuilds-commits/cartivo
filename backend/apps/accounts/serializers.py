from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .email_utils import normalize_email, is_disposable_email

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of the authenticated user's profile."""

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "date_joined",
            "is_staff",
            "is_superuser",
        )
        read_only_fields = ("id", "email", "date_joined", "is_staff", "is_superuser")


class AdminUserSerializer(serializers.ModelSerializer):
    """User representation for the admin account-management API.

    Exposes the account-control flags (is_active, is_staff). username,
    is_superuser, and timestamps are read-only: usernames are identity-bearing
    and superuser status is managed only via the Django admin.
    """

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "date_joined",
            "last_login",
            "is_active",
            "is_staff",
            "is_superuser",
        )
        read_only_fields = (
            "id",
            "username",
            "date_joined",
            "last_login",
            "is_superuser",
        )


class RegisterSerializer(serializers.ModelSerializer):
    """Validate and create a new user account."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "first_name", "last_name", "phone")
        extra_kwargs = {"email": {"required": True}}

    def validate(self, attrs):
        """Normalize email, reject disposable addresses, and run password validators."""
        email = attrs.get("email", "")
        if email:
            normalized = normalize_email(email)
            attrs["email"] = normalized
            if is_disposable_email(normalized):
                raise serializers.ValidationError(
                    {"email": "Disposable email addresses are not allowed."}
                )

        # Run Django's configured password validators (length, common-password,
        # numeric, and similarity to user attributes) at registration time.
        candidate = User(
            username=attrs.get("username", ""),
            email=email,
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        """Create a new user with the validated data."""
        return User.objects.create_user(**validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    """Validate current and new passwords for password change."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        """Verify the user's current password is correct."""
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        """Enforce Django password validators on the new password."""
        # Enforce the same password validators used at registration/reset.
        try:
            validate_password(value, user=self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class AddressSerializer(serializers.ModelSerializer):
    """CRUD serializer for the authenticated user's shipping addresses."""

    class Meta:
        from .models import Address

        model = Address
        fields = (
            "id",
            "label",
            "full_name",
            "address",
            "city",
            "postal_code",
            "country",
            "is_default",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
