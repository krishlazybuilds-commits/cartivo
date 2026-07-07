from rest_framework import serializers

from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    """Validate and serialize a single cart line item."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    product_image = serializers.ImageField(source="product.image", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default=None)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = (
            "id",
            "product",
            "product_name",
            "product_image",
            "variant",
            "variant_name",
            "unit_price",
            "quantity",
            "subtotal",
            "added_at",
        )
        read_only_fields = ("id", "added_at")

    def get_fields(self):
        """Make product/variant read-only when updating an existing item."""
        fields = super().get_fields()
        if self.instance is not None:
            fields["product"].read_only = True
            fields["variant"].read_only = True
        return fields

    def validate_quantity(self, value):
        """Ensure quantity is at least 1."""
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        """Check variant belongs to product and stock is sufficient."""
        product = attrs.get("product") or getattr(self.instance, "product", None)
        variant = attrs.get("variant") or getattr(self.instance, "variant", None)
        quantity = attrs.get("quantity") or getattr(self.instance, "quantity", 1)

        # Ensure variant belongs to the product.
        if variant and product and variant.product_id != product.pk:
            raise serializers.ValidationError(
                {"variant": "Variant does not belong to this product."}
            )

        # Stock check against variant or base product.
        if variant:
            if quantity > variant.stock:
                raise serializers.ValidationError(
                    {
                        "detail": (
                            f"Only {variant.stock} unit(s) of "
                            f"'{product.name} — {variant.name}' in stock."
                        )
                    }
                )
        elif product:
            if quantity > product.stock:
                raise serializers.ValidationError(
                    {"detail": f"Only {product.stock} unit(s) of '{product.name}' in stock."}
                )
        return attrs


class CartSerializer(serializers.ModelSerializer):
    """Read-only serializer for the authenticated user's cart with items and totals."""

    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "total", "item_count", "updated_at")
        read_only_fields = fields
