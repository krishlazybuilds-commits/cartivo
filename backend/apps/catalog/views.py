from django.db.models import Avg, Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAdminUser, IsAuthenticated, IsAuthenticatedOrReadOnly

from .filters import PostgresSearchFilter
from .models import Category, Product, ProductImage, ProductVariant, Review, WishlistItem
from .serializers import CategorySerializer, ProductImageSerializer, ProductSerializer, ProductVariantSerializer, ReviewSerializer, WishlistItemSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = "slug"
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticatedOrReadOnly()]
        return [IsAdminUser()]


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    lookup_field = "slug"
    filter_backends = (DjangoFilterBackend, PostgresSearchFilter, OrderingFilter)
    filterset_fields = ("category", "is_active")
    search_fields = ("name", "description", "sku")
    ordering_fields = ("price", "created_at", "name")

    def get_queryset(self):
        qs = Product.objects.select_related("category").prefetch_related("variants", "images").annotate(
            avg_rating=Avg("reviews__rating"),
            review_count=Count("reviews"),
        )
        # Only staff (who manage the catalog) may see inactive/draft products;
        # the public catalog is limited to active ones. Prevents leaking
        # unreleased products (and their stock/sku) via the public API.
        user = self.request.user
        if not (user and user.is_staff):
            qs = qs.filter(is_active=True)
        # Explicit, deterministic ordering (newest first, id as tiebreaker) so
        # pagination is stable. The annotations add a GROUP BY, which otherwise
        # makes the model's default ordering non-guaranteed for the paginator.
        return qs.order_by("-created_at", "id")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticatedOrReadOnly()]
        return [IsAdminUser()]


class ReviewViewSet(viewsets.ModelViewSet):
    """Product reviews. Anyone can read; authenticated users can create/update/delete their own."""

    serializer_class = ReviewSerializer
    filterset_fields = ("product", "rating")
    ordering_fields = ("created_at", "rating")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticatedOrReadOnly()]
        # create/update/delete all require auth; update/delete are further
        # scoped to the author's own reviews in get_queryset.
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Review.objects.select_related("user")
        # Restrict edits/deletes to the author's own reviews. Listing/retrieving
        # by product is handled by the filter backend (?product=<id>).
        if self.action in ("update", "partial_update", "destroy"):
            return qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class WishlistItemViewSet(viewsets.ModelViewSet):
    """Authenticated user's wishlist. Add/remove/view saved products."""

    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user).select_related("product")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ProductVariantViewSet(viewsets.ModelViewSet):
    """Variants for a product. Staff can create/update/delete; anyone can read."""
    serializer_class = ProductVariantSerializer
    filterset_fields = ("product", "is_active")

    def get_queryset(self):
        return ProductVariant.objects.select_related("product").all()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticatedOrReadOnly()]
        return [IsAdminUser()]


class ProductImageViewSet(viewsets.ModelViewSet):
    """Staff-only: manage additional product images. Anyone can read."""
    serializer_class = ProductImageSerializer
    filterset_fields = ("product",)

    def get_queryset(self):
        return ProductImage.objects.select_related("product").all()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticatedOrReadOnly()]
        return [IsAdminUser()]

    def get_parsers(self):
        from rest_framework.parsers import MultiPartParser, JSONParser
        return [MultiPartParser(), JSONParser()]
