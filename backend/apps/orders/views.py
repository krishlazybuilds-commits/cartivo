import logging

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse

from apps.cart.models import Cart
from apps.catalog.models import Product
from config.throttling import OrderWriteThrottle, PaymentThrottle

from .models import Coupon, Order, OrderItem, StripeEvent
from .serializers import (
    CheckoutSerializer,
    CouponResponseSerializer,
    OrderSerializer,
    ShippingEstimateSerializer,
    ShippingEstimateResponseSerializer,
    ValidateCouponSerializer,
    calculate_estimate,
)
from .tasks import send_order_confirmation_task, send_payment_confirmed_task

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


def _restock_order(order):
    """Return an order's items to inventory (atomic, race-free)."""
    for item in order.items.select_related("product"):
        Product.objects.filter(pk=item.product_id).update(
            stock=F("stock") + item.quantity
        )


class ShippingEstimateView(APIView):
    """Return a flat-rate shipping + tax estimate for a given country/subtotal.

    Open to all (guests and authenticated users alike). Used to show an
    estimated total on the cart and product pages before checkout.
    """
    permission_classes = [AllowAny]
    throttle_classes = []  # public read; no auth throttle needed

    @extend_schema(
        request=ShippingEstimateSerializer,
        responses={200: ShippingEstimateResponseSerializer},
        summary="Get shipping & tax estimate",
        description=(
            "Returns flat-rate shipping cost and estimated tax for the given "
            "country and order subtotal. Free shipping applies on US orders "
            "over $100. Tax (8%) is estimated for US orders only. "
            "Final amounts are confirmed at payment."
        ),
        tags=["orders"],
    )
    def post(self, request):
        ser = ShippingEstimateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        result = calculate_estimate(
            ser.validated_data["country"],
            float(ser.validated_data["subtotal"]),
        )
        return Response(result)


class ValidateCouponView(APIView):
    """Validate a coupon code against a subtotal and return the discount amount.

    Open to all (guests and authenticated users). Used on the frontend to show
    the discount before the user submits the checkout form.
    """
    permission_classes = [AllowAny]
    throttle_classes = []

    @extend_schema(
        request=ValidateCouponSerializer,
        responses={200: CouponResponseSerializer},
        summary="Validate a coupon code",
        tags=["orders"],
    )
    def post(self, request):
        ser = ValidateCouponSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        code = ser.validated_data["code"].strip().upper()
        subtotal = ser.validated_data["subtotal"]

        try:
            coupon = Coupon.objects.get(code__iexact=code)
        except Coupon.DoesNotExist:
            return Response({
                "valid": False,
                "code": code,
                "discount_type": "",
                "value": 0,
                "discount_amount": 0,
                "message": "Invalid coupon code.",
            })

        valid, reason = coupon.is_valid(subtotal)
        if not valid:
            return Response({
                "valid": False,
                "code": code,
                "discount_type": coupon.discount_type,
                "value": coupon.value,
                "discount_amount": 0,
                "message": reason,
            })

        discount_amount = coupon.calculate_discount(subtotal)
        return Response({
            "valid": True,
            "code": coupon.code,
            "discount_type": coupon.discount_type,
            "value": coupon.value,
            "discount_amount": discount_amount,
            "message": f"Coupon applied! You save ${discount_amount:.2f}.",
        })


@extend_schema_view(
    list=extend_schema(
        summary="List my orders",
        tags=["orders"],
    ),
    retrieve=extend_schema(
        summary="Get order detail",
        tags=["orders"],
    ),
    create=extend_schema(
        summary="Place an order",
        description=(
            "Creates an order from the authenticated user's server-side cart. "
            "Decrements stock and clears the cart."
        ),
        request=CheckoutSerializer,
        responses={201: OrderSerializer},
        tags=["orders"],
    ),
)
class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.action == "pay":
            return [PaymentThrottle()]
        return [OrderWriteThrottle()]

    def get_queryset(self):
        # list/retrieve require auth (enforced by get_permissions).
        # Guard against schema-generation calls which run with an anonymous user.
        if getattr(self, "swagger_fake_view", False):
            return Order.objects.none()
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        checkout = CheckoutSerializer(data=request.data, context={"request": request})
        checkout.is_valid(raise_exception=True)
        data = checkout.validated_data

        # --- Resolve coupon (optional) ----------------------------------------
        coupon = None
        coupon_code = data.get("coupon_code", "").strip()
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code)
            except Coupon.DoesNotExist:
                return Response(
                    {"detail": "Invalid coupon code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # --- Checkout from the authenticated user's server-side cart ----------
        cart = Cart.objects.filter(user=request.user).first()
        if not cart or not cart.items.exists():
            return Response(
                {"detail": "Your cart is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            cart_items = list(cart.items.select_related("product"))
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
                        {"detail": (
                            f"Insufficient stock for '{product.name}'. "
                            f"Available: {product.stock}."
                        )},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            order = Order.objects.create(
                user=request.user,
                shipping_full_name=data["shipping_full_name"],
                shipping_address=data["shipping_address"],
                shipping_city=data["shipping_city"],
                shipping_postal_code=data["shipping_postal_code"],
                shipping_country=data["shipping_country"],
            )
            order_items = []
            for item in cart_items:
                product = locked_products[item.product_id]
                product.stock = F("stock") - item.quantity
                product.save(update_fields=["stock"])
                order_items.append(OrderItem(
                    order=order,
                    product=product,
                    unit_price=product.price,
                    quantity=item.quantity,
                ))
            OrderItem.objects.bulk_create(order_items)
            # Apply coupon discount if provided.
            subtotal = order.recalculate_total()
            if coupon:
                valid, reason = coupon.is_valid(subtotal + order.discount)
                if not valid:
                    transaction.set_rollback(True)
                    return Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)
                order.discount = coupon.calculate_discount(subtotal + order.discount)
                order.coupon = coupon
                order.total = max(subtotal - order.discount, 0)
                coupon.times_used = F("times_used") + 1
                coupon.save(update_fields=["times_used"])
            order.save(update_fields=["total", "discount", "coupon"])
            cart.items.all().delete()

        serializer = self.get_serializer(order)
        send_order_confirmation_task.delay(order.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Start Stripe payment",
        description="Creates a Stripe Checkout Session and returns the redirect URL.",
        responses={200: {"type": "object", "properties": {"url": {"type": "string"}}}},
        tags=["orders"],
    )
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
            # Propagate order_id onto the PaymentIntent (and its charge) so
            # payment_failed / charge.refunded events can be matched back.
            payment_intent_data={"metadata": {"order_id": order.id}},
        )
        # Persist the session id so checkout.session.expired can be correlated.
        Order.objects.filter(pk=order.pk).update(stripe_session_id=session.id)
        return Response({"url": session.url})

    @extend_schema(
        summary="Cancel a pending order",
        description="Cancels a PENDING order and restocks its items.",
        responses={200: OrderSerializer},
        tags=["orders"],
    )
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
    session = event["data"]["object"]
    metadata = session.get("metadata") or {}
    order_id = metadata.get("order_id")
    if not order_id:
        return

    updated = Order.objects.filter(
        pk=order_id, status=Order.Status.PENDING
    ).update(
        status=Order.Status.PAID,
        # Capture the PaymentIntent so a later refund can be matched.
        stripe_payment_intent=session.get("payment_intent") or "",
    )
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


def _handle_checkout_expired(event):
    """A Checkout session expired unpaid: cancel + restock the pending order.

    Releases stock reserved at order creation. Status-filtered to PENDING so it
    never disturbs an order that was paid or already cancelled.
    """
    metadata = event["data"]["object"].get("metadata") or {}
    order_id = metadata.get("order_id")
    if not order_id:
        return

    order = (
        Order.objects.select_for_update()
        .filter(pk=order_id, status=Order.Status.PENDING)
        .first()
    )
    if order is None:
        return
    _restock_order(order)
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])


def _handle_payment_failed(event):
    """A PaymentIntent failed. Leave the order PENDING so the customer can retry;
    record it for visibility."""
    metadata = event["data"]["object"].get("metadata") or {}
    order_id = metadata.get("order_id")
    logger.warning("Stripe payment failed for order_id=%s", order_id)


def _handle_charge_refunded(event):
    """A charge was refunded: mark the order REFUNDED and restock its items.

    Idempotent via the status filter (PAID -> REFUNDED), so duplicate refund
    events don't restock twice.
    """
    charge = event["data"]["object"]
    metadata = charge.get("metadata") or {}
    order_id = metadata.get("order_id")
    payment_intent = charge.get("payment_intent")

    qs = Order.objects.select_for_update().filter(status=Order.Status.PAID)
    if order_id:
        order = qs.filter(pk=order_id).first()
    elif payment_intent:
        order = qs.filter(stripe_payment_intent=payment_intent).first()
    else:
        order = None

    if order is None:
        return
    _restock_order(order)
    order.status = Order.Status.REFUNDED
    order.save(update_fields=["status"])


# Maps Stripe event types to their handlers. Unlisted events are acknowledged
# (200) but otherwise ignored.
_EVENT_HANDLERS = {
    "checkout.session.completed": _handle_checkout_completed,
    "checkout.session.expired": _handle_checkout_expired,
    "payment_intent.payment_failed": _handle_payment_failed,
    "charge.refunded": _handle_charge_refunded,
}


@extend_schema(
    summary="Stripe webhook receiver",
    description=(
        "Receives and processes Stripe webhook events. "
        "Validates the `Stripe-Signature` header. "
        "Idempotent: duplicate event IDs are silently ignored."
    ),
    request=None,
    responses={
        200: OpenApiResponse(description="Event received and processed."),
        400: OpenApiResponse(description="Invalid payload or signature."),
        405: OpenApiResponse(description="Method not allowed."),
    },
    tags=["orders"],
    exclude=False,
)
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

            handler = _EVENT_HANDLERS.get(event_type)
            if handler is not None:
                handler(event)
    except IntegrityError:
        return JsonResponse({"received": True, "duplicate": True})

    return JsonResponse({"received": True})
