import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.cart.models import Cart
from apps.catalog.models import Product

from .models import Order, OrderItem, StripeEvent
from .serializers import CheckoutSerializer, OrderSerializer
from .tasks import send_order_confirmation_task, send_payment_confirmed_task

stripe.api_key = settings.STRIPE_SECRET_KEY


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
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
            cart_items = list(cart.items.select_related("product"))

            # Lock the product rows for the duration of the transaction so two
            # concurrent checkouts can't both pass the stock check and oversell.
            locked_products = {
                p.id: p
                for p in Product.objects.select_for_update().filter(
                    id__in=[item.product_id for item in cart_items]
                )
            }

            for item in cart_items:
                product = locked_products[item.product_id]
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
                product = locked_products[item.product_id]
                # Atomic decrement at the DB level (no read-then-write gap).
                product.stock = F("stock") - item.quantity
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
        send_order_confirmation_task.delay(order.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.PENDING:
            return Response(
                {"detail": "Only pending orders can be paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        frontend_base = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else "http://localhost:3000"

        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(item.unit_price * 100),
                    "product_data": {"name": item.product.name},
                },
                "quantity": item.quantity,
            }
            for item in order.items.select_related("product")
        ]

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=f"{frontend_base}/orders?placed={order.id}&paid=1",
            cancel_url=f"{frontend_base}/orders/{order.id}",
            metadata={"order_id": order.id},
        )
        return Response({"url": session.url})

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        # Ownership is enforced by get_queryset (filtered to request.user).
        order = self.get_object()

        with transaction.atomic():
            # Lock the order row and re-check status inside the transaction so
            # concurrent cancels (or a cancel racing the Stripe webhook that
            # marks the order PAID) can't double-restock or overwrite a paid
            # order with CANCELLED.
            order = (
                Order.objects.select_for_update()
                .filter(pk=order.pk)
                .first()
            )
            if order is None:
                return Response(
                    {"detail": "Order not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if order.status != Order.Status.PENDING:
                return Response(
                    {"detail": "Only pending orders can be cancelled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            for item in order.items.select_related("product"):
                # Atomic restock; F() avoids a read-then-write race.
                Product.objects.filter(pk=item.product_id).update(
                    stock=F("stock") + item.quantity
                )
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)


def _handle_checkout_completed(event):
    """Mark the matching order PAID and queue its confirmation email.

    The status filter (PENDING -> PAID) makes the transition itself idempotent:
    only the first delivery that flips the order enqueues the email, which is
    scheduled with transaction.on_commit so it never fires on a rolled-back
    transaction.
    """
    metadata = event["data"]["object"].get("metadata") or {}
    order_id = metadata.get("order_id")
    if not order_id:
        return

    updated = Order.objects.filter(
        pk=order_id, status=Order.Status.PENDING
    ).update(status=Order.Status.PAID)
    if not updated:
        return

    order = (
        Order.objects.filter(pk=order_id)
        .prefetch_related("items__product")
        .select_related("user")
        .first()
    )
    if order:
        transaction.on_commit(lambda: send_payment_confirmed_task.delay(order.id))


@csrf_exempt
def stripe_webhook(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        return HttpResponse(status=400)

    event_id = event.get("id")
    event_type = event.get("type", "")

    # Idempotency: Stripe delivers each event at least once and retries on any
    # non-2xx response, so the same event can arrive multiple times. Recording
    # the event_id under a unique constraint inside the transaction means a
    # duplicate delivery hits an IntegrityError and skips all side effects,
    # while the handler's DB writes roll back together with the marker if
    # processing fails (so a genuine retry can reprocess).
    try:
        with transaction.atomic():
            StripeEvent.objects.create(event_id=event_id, event_type=event_type)

            if event_type == "checkout.session.completed":
                _handle_checkout_completed(event)
    except IntegrityError:
        return JsonResponse({"received": True, "duplicate": True})

    return JsonResponse({"received": True})
