from decimal import Decimal

from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_name",
            "unit_price",
            "quantity",
            "subtotal",
        )
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    order_number = serializers.UUIDField(read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "status",
            "total",
            "shipping_full_name",
            "shipping_address",
            "shipping_city",
            "shipping_postal_code",
            "shipping_country",
            "guest_email",
            "items",
            "created_at",
        )
        read_only_fields = ("id", "order_number", "status", "total", "items", "created_at")


class CheckoutSerializer(serializers.Serializer):
    """Validates shipping details for creating an order from the cart.

    For guest checkouts (unauthenticated), ``guest_email`` is required so we
    can send the order confirmation. For authenticated users it is ignored.

    ``items`` carries the cart lines for guest orders (guests have no
    server-side cart), each entry being ``{product_id, quantity}``.
    """

    shipping_full_name = serializers.CharField(max_length=200)
    shipping_address = serializers.CharField(max_length=255)
    shipping_city = serializers.CharField(max_length=120)
    shipping_postal_code = serializers.CharField(max_length=20)
    shipping_country = serializers.CharField(max_length=120)
    # Guest-only fields
    guest_email = serializers.EmailField(required=False, allow_blank=True, default="")
    items = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def validate(self, data):
        # guest_email is required when the request is unauthenticated.
        request = self.context.get("request")
        is_guest = not (request and request.user and request.user.is_authenticated)
        if is_guest and not data.get("guest_email"):
            raise serializers.ValidationError(
                {"guest_email": "Email is required for guest checkout."}
            )
        if is_guest and not data.get("items"):
            raise serializers.ValidationError(
                {"items": "Cart items are required for guest checkout."}
            )
        return data


class GuestCartItemSerializer(serializers.Serializer):
    """One line of a guest cart, submitted with the checkout payload."""
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


# ---------------------------------------------------------------------------
# Shipping / tax estimate
# ---------------------------------------------------------------------------

# Flat-rate shipping tiers (demonstration — swap for a real carrier API).
_FREE_SHIPPING_THRESHOLD = 100   # USD
_DOMESTIC_RATE = 5.99
_INTERNATIONAL_RATE = 14.99
_DOMESTIC_COUNTRIES = {"us", "usa", "united states"}
# Flat 8 % demo tax applied to domestic orders only.
_TAX_RATE = 0.08


class ShippingEstimateSerializer(serializers.Serializer):
    """Request body for the shipping/tax estimate endpoint."""
    country = serializers.CharField(max_length=120)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))


class ShippingEstimateResponseSerializer(serializers.Serializer):
    """Response shape of the shipping/tax estimate endpoint."""
    shipping = serializers.DecimalField(max_digits=10, decimal_places=2)
    tax = serializers.DecimalField(max_digits=10, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    free_shipping_threshold = serializers.DecimalField(max_digits=10, decimal_places=2)
    note = serializers.CharField()


def calculate_estimate(country: str, subtotal: float) -> dict:
    """Return a shipping + tax breakdown for the given country and subtotal."""
    is_domestic = country.strip().lower() in _DOMESTIC_COUNTRIES
    shipping = 0.0 if subtotal >= _FREE_SHIPPING_THRESHOLD else (
        _DOMESTIC_RATE if is_domestic else _INTERNATIONAL_RATE
    )
    tax = round(subtotal * _TAX_RATE, 2) if is_domestic else 0.0
    return {
        "shipping": round(shipping, 2),
        "tax": tax,
        "total": round(subtotal + shipping + tax, 2),
        "free_shipping_threshold": _FREE_SHIPPING_THRESHOLD,
        "note": (
            "Free shipping on US orders over $100. "
            "Tax (8%) applies to US orders. "
            "Final amounts confirmed at payment."
        ),
    }
