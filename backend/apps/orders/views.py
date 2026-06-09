from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.cart.models import Cart

from .models import Order, OrderItem
from .serializers import CheckoutSerializer, OrderSerializer


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """List/retrieve the user's orders and create one from their cart."""

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        checkout = CheckoutSerializer(data=request.data)
        checkout.is_valid(raise_exception=True)

        cart = Cart.objects.filter(user=request.user).first()
        if not cart or not cart.items.exists():
            return Response(
                {"detail": "Your cart is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Lock the involved products to prevent overselling under concurrency.
            cart_items = list(cart.items.select_related("product"))
            for item in cart_items:
                product = item.product
                if item.quantity > product.stock:
                    return Response(
                        {
                            "detail": (
                                f"Insufficient stock for '{product.name}'. "
                                f"Available: {product.stock}."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            order = Order.objects.create(user=request.user, **checkout.validated_data)
            order_items = []
            for item in cart_items:
                product = item.product
                product.stock -= item.quantity
                product.save(update_fields=["stock"])
                order_items.append(
                    OrderItem(
                        order=order,
                        product=product,
                        unit_price=product.price,
                        quantity=item.quantity,
                    )
                )
            OrderItem.objects.bulk_create(order_items)
            order.recalculate_total()
            order.save(update_fields=["total"])
            cart.items.all().delete()

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.PENDING:
            return Response(
                {"detail": "Only pending orders can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for item in order.items.select_related("product"):
                item.product.stock += item.quantity
                item.product.save(update_fields=["stock"])
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)
