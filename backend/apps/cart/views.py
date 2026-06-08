from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Cart, CartItem
from .serializers import CartItemSerializer, CartSerializer


class CartViewSet(viewsets.ViewSet):
    """Single endpoint to view and clear the authenticated user's cart."""

    permission_classes = [IsAuthenticated]

    def _get_cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart

    def list(self, request):
        serializer = CartSerializer(self._get_cart(request))
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def clear(self, request):
        self._get_cart(request).items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartItemViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Add, update quantity, or remove items from the user's cart."""

    serializer_class = CartItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CartItem.objects.filter(cart__user=self.request.user).select_related(
            "product"
        )

    def perform_create(self, serializer):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        product = serializer.validated_data["product"]
        quantity = serializer.validated_data.get("quantity", 1)

        # If the product is already in the cart, increment instead of duplicating.
        item = cart.items.filter(product=product).first()
        if item:
            new_quantity = item.quantity + quantity
            if new_quantity > product.stock:
                raise ValidationError(
                    {"detail": f"Only {product.stock} unit(s) of '{product.name}' in stock."}
                )
            item.quantity = new_quantity
            item.save()
            serializer.instance = item
        else:
            serializer.save(cart=cart)
