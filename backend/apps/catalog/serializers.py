from rest_framework import serializers

from .models import Category, Product, ProductImage, ProductVariant, Review, WishlistItem


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


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    avg_rating = serializers.FloatField(read_only=True, default=None)
    review_count = serializers.IntegerField(read_only=True, default=0)
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
            "stock",
            "sku",
            "image",
            "is_active",
            "in_stock",
            "avg_rating",
            "review_count",
            "variants",
            "images",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "product",
            "username",
            "rating",
            "title",
            "body",
            "created_at",
        )
        read_only_fields = ("id", "username", "created_at")

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
