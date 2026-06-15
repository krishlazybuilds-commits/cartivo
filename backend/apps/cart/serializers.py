from rest_framework import serializers

from apps.catalog.models import Product

from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    unit_price = serializers.DecimalField(
        source="product.price", max_digits=10, decimal_places=2, read_only=True
    )
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = CartItem
        fields = (
            "id",
            "product",
            "product_name",
            "unit_price",
            "quantity",
            "subtotal",
            "added_at",
        )
        read_only_fields = ("id", "added_at")

    def get_fields(self):
        fields = super().get_fields()
        # Prevent reassigning a cart line to a different product on update;
        # product should only be settable when adding a new item to the cart.
        if self.instance is not None:
            fields["product"].read_only = True
        return fields

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        # On a partial update (e.g. changing quantity via the +/- buttons),
        # `product` isn't in the payload, so fall back to the existing item.
        product = attrs.get("product") or getattr(self.instance, "product", None)
        quantity = attrs.get("quantity")
        if quantity is None:
            quantity = getattr(self.instance, "quantity", 1)
        if product and quantity > product.stock:
            raise serializers.ValidationError(
                {"detail": f"Only {product.stock} unit(s) of '{product.name}' in stock."}
            )
        return attrs


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "total", "item_count", "updated_at")
        read_only_fields = fields
