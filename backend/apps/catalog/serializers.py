from rest_framework import serializers

from .models import Category, Product, ProductImage, ProductVariant, Review, Warehouse, WarehouseStock, WishlistItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "description", "parent", "created_at")
        read_only_fields = ("id", "slug", "created_at")


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ("id", "image", "alt", "order")
        read_only_fields = ("id",)


class ProductVariantSerializer(serializers.ModelSerializer):
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    in_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = ("id", "name", "sku", "price", "effective_price", "stock", "in_stock", "is_active")
        read_only_fields = ("id", "effective_price", "in_stock")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and not (request.user and request.user.is_staff):
            fields.pop("stock", None)
        return fields


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    avg_rating = serializers.FloatField(read_only=True, default=None)
    review_count = serializers.IntegerField(read_only=True, default=0)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    display_badge = serializers.CharField(read_only=True, allow_null=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "category",
            "category_name",
            "name",
            "slug",
            "description",
            "price",
            "sale_price",
            "effective_price",
            "stock",
            "sku",
            "image",
            "is_active",
            "is_featured",
            "is_new",
            "on_sale",
            "badge",
            "display_badge",
            "in_stock",
            "avg_rating",
            "review_count",
            "variants",
            "images",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and not (request.user and request.user.is_staff):
            fields.pop("stock", None)
        return fields


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "product",
            "product_name",
            "username",
            "rating",
            "title",
            "body",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "product_name", "username", "created_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and request.user and request.user.is_staff:
            fields["status"].read_only = False
        else:
            fields["status"].read_only = True
        return fields

    def validate(self, data):
        request = self.context.get("request")
        if request and request.user:
            # Only enforce uniqueness on create (not update).
            if not self.instance:
                product = data.get("product")
                if Review.objects.filter(product=product, user=request.user).exists():
                    raise serializers.ValidationError(
                        {"detail": "You have already reviewed this product."}
                    )
        return data


class WishlistItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_price = serializers.DecimalField(
        source="product.price", max_digits=10, decimal_places=2, read_only=True
    )
    product_image = serializers.ImageField(source="product.image", read_only=True)

    class Meta:
        model = WishlistItem
        fields = (
            "id",
            "product",
            "product_name",
            "product_slug",
            "product_price",
            "product_image",
            "added_at",
        )
        read_only_fields = ("id", "added_at")

    def validate_product(self, value):
        request = self.context.get("request")
        if request and WishlistItem.objects.filter(user=request.user, product=value).exists():
            raise serializers.ValidationError("This product is already in your wishlist.")
        return value


class ProductImportSerializer(serializers.Serializer):
    file = serializers.FileField()

    class Meta:
        fields = ("file",)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ("id", "name", "code", "address", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = WarehouseStock
        fields = (
            "id",
            "warehouse",
            "product",
            "product_name",
            "variant",
            "variant_name",
            "stock",
        )
        read_only_fields = ("id", "product_name")
        extra_kwargs = {
            "variant": {"required": False, "allow_null": True},
        }

    def get_variant_name(self, obj):
        return obj.variant.name if obj.variant else None
