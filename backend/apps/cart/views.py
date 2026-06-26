from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from config.throttling import CartWriteThrottle

from .models import Cart, CartItem
from .serializers import CartItemSerializer, CartSerializer


@extend_schema_view(
    list=extend_schema(summary="View cart", tags=["cart"]),
)
class CartViewSet(viewsets.ViewSet):
    """Single endpoint to view and clear the authenticated user's cart."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [CartWriteThrottle]
    serializer_class = CartSerializer  # hint for spectacular

    def _get_cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart

    def list(self, request):
        cart = self._get_cart(request)
        # Prefetch items and their products so serializing items and computing
        # total/item_count don't trigger a query per cart item (avoids N+1).
        cart = Cart.objects.prefetch_related("items__product").get(pk=cart.pk)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @extend_schema(summary="Clear cart", tags=["cart"], responses={204: None})
    @action(detail=False, methods=["post"])
    def clear(self, request):
        self._get_cart(request).items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    create=extend_schema(summary="Add item to cart", tags=["cart"]),
    partial_update=extend_schema(
        summary="Update cart item quantity",
        tags=["cart"],
        parameters=[OpenApiParameter("id", OpenApiTypes.INT, OpenApiParameter.PATH)],
    ),
    destroy=extend_schema(
        summary="Remove item from cart",
        tags=["cart"],
        parameters=[OpenApiParameter("id", OpenApiTypes.INT, OpenApiParameter.PATH)],
    ),
)
class CartItemViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Add, update quantity, or remove items from the user's cart."""

    serializer_class = CartItemSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [CartWriteThrottle]

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user).select_related("product")

    def perform_create(self, serializer):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        product = serializer.validated_data["product"]
        variant = serializer.validated_data.get("variant")
        quantity = serializer.validated_data.get("quantity", 1)

        item = cart.items.filter(product=product, variant=variant).first()
        if item:
            stock = variant.stock if variant else product.stock
            new_quantity = item.quantity + quantity
            if new_quantity > stock:
                raise ValidationError({"detail": f"Only {stock} unit(s) available."})
            item.quantity = new_quantity
            item.save()
            serializer.instance = item
        else:
            serializer.save(cart=cart)
