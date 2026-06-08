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

    class Meta:
        model = Order
        fields = (
            "id",
            "status",
            "total",
            "shipping_full_name",
            "shipping_address",
            "shipping_city",
            "shipping_postal_code",
            "shipping_country",
            "items",
            "created_at",
        )
        read_only_fields = ("id", "status", "total", "items", "created_at")


class CheckoutSerializer(serializers.Serializer):
    """Validates shipping details for creating an order from the cart."""

    shipping_full_name = serializers.CharField(max_length=200)
    shipping_address = serializers.CharField(max_length=255)
    shipping_city = serializers.CharField(max_length=120)
    shipping_postal_code = serializers.CharField(max_length=20)
    shipping_country = serializers.CharField(max_length=120)
