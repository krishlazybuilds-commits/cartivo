from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
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
        read_only_fields = ("id", "date_joined", "is_staff", "is_superuser")


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
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "first_name", "last_name", "phone")
        extra_kwargs = {"email": {"required": True}}

    def validate(self, attrs):
        # Reject if the email is already registered (case-insensitive).
        email = attrs.get("email", "")
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "A user with this email already exists."}
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
        return User.objects.create_user(**validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        # Enforce the same password validators used at registration/reset.
        try:
            validate_password(value, user=self.context["request"].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class AddressSerializer(serializers.ModelSerializer):
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
