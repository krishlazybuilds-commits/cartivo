import logging

import stripe
from django.conf import settings
from django.db import IntegrityError, models as django_models, transaction
from django.db.models import F
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse

from apps.cart.models import Cart
from apps.catalog.models import Product
from config.throttling import OrderWriteThrottle, PaymentThrottle, CouponAnonThrottle, ShippingEstimateAnonThrottle, OrderVelocityThrottle, OrderLookupThrottle

from .models import Coupon, Order, OrderItem, StripeEvent
from .services import CheckoutError, resolve_coupon, create_order_and_items, build_stripe_line_items
from .serializers import (
    CheckoutSerializer,
    CouponResponseSerializer,
    CouponSerializer,
    GuestCheckoutSerializer,
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
    order.restock()


def _release_pending_order(order_id):
    """Cancel + restock a PENDING order whose Stripe session couldn't be created.

    Guest checkout commits the order and decrements stock before the Stripe
    Checkout Session is created. If that Stripe call fails, the stock would stay
    reserved against an unpayable order until the 30-min stale-order sweep. This
    releases it immediately. Atomic + status-filtered to PENDING so it can never
    disturb an order that has since been paid.
    """
    with transaction.atomic():
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


class DashboardView(APIView):
    """Staff-only sales analytics summary."""
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(summary="Admin dashboard stats", tags=["orders"])
    def get(self, request):
        from django.db.models import Sum, Count
        from django.utils import timezone
        import datetime

        now = timezone.now()
        thirty_days_ago = now - datetime.timedelta(days=30)

        paid_statuses = [Order.Status.PAID, Order.Status.SHIPPED, Order.Status.DELIVERED]

        totals = Order.objects.filter(status__in=paid_statuses).aggregate(
            revenue=Sum("total"),
            orders=Count("id"),
        )
        monthly = Order.objects.filter(
            status__in=paid_statuses, created_at__gte=thirty_days_ago
        ).aggregate(
            revenue=Sum("total"),
            orders=Count("id"),
        )

        status_counts = {
            s: Order.objects.filter(status=s).count()
            for s in [st.value for st in Order.Status]
        }

        top_products = (
            OrderItem.objects
            .filter(order__status__in=paid_statuses)
            .values("product__name", "variant__name")
            .annotate(units=Sum("quantity"), revenue=Sum(
                django_models.ExpressionWrapper(
                    django_models.F("unit_price") * django_models.F("quantity"),
                    output_field=django_models.DecimalField()
                )
            ))
            .order_by("-units")[:5]
        )

        return Response({
            "all_time": {
                "revenue": totals["revenue"] or 0,
                "orders": totals["orders"] or 0,
            },
            "last_30_days": {
                "revenue": monthly["revenue"] or 0,
                "orders": monthly["orders"] or 0,
            },
            "by_status": status_counts,
            "top_products": list(top_products),
        })


class CouponViewSet(viewsets.ModelViewSet):
    """Staff-only CRUD for coupons."""
    queryset = Coupon.objects.all().order_by("-created_at")
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAdminUser]
    search_fields = ("code",)
    filterset_fields = ("is_active", "discount_type")


class ShippingEstimateView(APIView):
    """Return a flat-rate shipping + tax estimate for a given country/subtotal.

    Open to all (guests and authenticated users alike). Used to show an
    estimated total on the cart and product pages before checkout.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ShippingEstimateAnonThrottle]

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
    throttle_classes = [CouponAnonThrottle]

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
        if self.action == "create":
            return [OrderWriteThrottle(), OrderVelocityThrottle()]
        if self.action == "pay":
            return [PaymentThrottle()]
        return [OrderWriteThrottle()]

    def get_queryset(self):
        # list/retrieve require auth (enforced by get_permissions).
        # Guard against schema-generation calls which run with an anonymous user.
        if getattr(self, "swagger_fake_view", False):
            return Order.objects.none()
        # Staff see all orders; regular users see only their own.
        if self.request.user.is_staff:
            qs = (
                Order.objects.prefetch_related("items__product", "items__variant")
                .select_related("user")
                .order_by("-created_at")
            )
            # Apply filters
            status_param = self.request.query_params.get("status")
            if status_param:
                qs = qs.filter(status=status_param)

            has_refund_request = self.request.query_params.get("has_refund_request")
            if has_refund_request == "true":
                qs = qs.exclude(refund_request_reason="")

            search_param = self.request.query_params.get("search")
            if search_param:
                search_param = search_param.strip()
                from django.db.models import Q
                qs = qs.filter(
                    Q(order_number__icontains=search_param) |
                    Q(shipping_full_name__icontains=search_param) |
                    Q(guest_email__icontains=search_param) |
                    Q(user__username__icontains=search_param)
                )
            return qs
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items__product", "items__variant")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        checkout = CheckoutSerializer(data=request.data, context={"request": request})
        checkout.is_valid(raise_exception=True)
        data = checkout.validated_data

        try:
            coupon = resolve_coupon(data.get("coupon_code", ""))
        except CheckoutError as e:
            return Response({"detail": e.detail}, status=e.status_code)

        cart = Cart.objects.filter(user=request.user).first()
        if not cart or not cart.items.exists():
            return Response(
                {"detail": "Your cart is empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart_items = cart.items.select_related("product", "variant")
        items = [
            {
                "product_id": ci.product_id,
                "quantity": ci.quantity,
                "variant_id": ci.variant_id,
            }
            for ci in cart_items
        ]

        try:
            order, _ = create_order_and_items(
                order_kwargs={
                    "user": request.user,
                    "shipping_full_name": data["shipping_full_name"],
                    "shipping_address": data["shipping_address"],
                    "shipping_city": data["shipping_city"],
                    "shipping_postal_code": data["shipping_postal_code"],
                    "shipping_country": data["shipping_country"],
                },
                items=items,
                coupon=coupon,
            )
        except CheckoutError as e:
            return Response({"detail": e.detail}, status=e.status_code)

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

        user = request.user
        line_items = build_stripe_line_items(
            order.items.select_related("product"),
            order.shipping_cost,
            order.tax_amount,
        )

        # All Stripe network calls are wrapped so a provider error/timeout
        # surfaces as a clean 502 instead of an unhandled 500. The order stays
        # PENDING, so the customer can simply retry payment.
        try:
            # Get or create a Stripe Customer for this user so returning
            # customers have their details pre-filled and Stripe can track
            # payment history.
            if user.stripe_customer_id:
                stripe_customer_id = user.stripe_customer_id
            else:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=f"{user.first_name} {user.last_name}".strip() or user.username,
                    metadata={"user_id": user.pk},
                )
                stripe_customer_id = customer.id
                user.stripe_customer_id = stripe_customer_id
                user.save(update_fields=["stripe_customer_id"])

            session_kwargs = {
                "payment_method_types": ["card"],
                "line_items": line_items,
                "mode": "payment",
                "customer": stripe_customer_id,
                "success_url": f"{frontend_base}/orders?placed={order.id}&paid=1",
                "cancel_url": f"{frontend_base}/orders/{order.id}",
                "metadata": {"order_id": order.id},
                # Propagate order_id onto the PaymentIntent (and its charge) so
                # payment_failed / charge.refunded events can be matched back.
                "payment_intent_data": {"metadata": {"order_id": order.id}},
            }

            if order.discount > 0:
                # Create a one-time Stripe coupon for the order's discount
                # amount. This ensures the customer is charged order.total while
                # preserving the full-price item breakdown in the Stripe
                # UI/receipt.
                coupon = stripe.Coupon.create(
                    amount_off=int(order.discount * 100),
                    currency="usd",
                    duration="once",
                    name=f"Discount for Order {order.order_number_short}",
                )
                session_kwargs["discounts"] = [{"coupon": coupon.id}]

            session = stripe.checkout.Session.create(**session_kwargs)
        except stripe.error.StripeError:
            logger.exception(
                "Stripe checkout session creation failed for order %s", order.id
            )
            return Response(
                {"detail": "Unable to reach the payment provider. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
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

            _restock_order(order)
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)

    @extend_schema(
        summary="Request a refund",
        description="Customer submits a refund reason for a PAID or DELIVERED order. Notifies staff by email.",
        request={"application/json": {"type": "object", "properties": {"reason": {"type": "string"}}, "required": ["reason"]}},
        responses={200: OrderSerializer},
        tags=["orders"],
    )
    @action(detail=True, methods=["post"], url_path="refund-request")
    def refund_request(self, request, pk=None):
        order = self.get_object()
        if order.status not in (Order.Status.PAID, Order.Status.SHIPPED, Order.Status.DELIVERED):
            return Response(
                {"detail": "Only paid or delivered orders can be refunded."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.refund_request_reason:
            return Response(
                {"detail": "A refund request has already been submitted for this order."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"detail": "A reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        order.refund_request_reason = reason
        order.save(update_fields=["refund_request_reason"])

        # Email staff.
        from django.contrib.auth import get_user_model
        from django.core.mail import send_mail
        User = get_user_model()
        staff_emails = list(
            User.objects.filter(is_staff=True, is_active=True)
            .exclude(email="")
            .values_list("email", flat=True)
        )
        if staff_emails:
            customer = order.user.email if order.user else order.guest_email
            try:
                send_mail(
                    subject=f"[Cartivo] Refund request for Order {order.order_number_short}",
                    message=(
                        f"Customer: {customer}\n"
                        f"Order: {order.order_number_short} (#{order.id})\n"
                        f"Status: {order.status}\n"
                        f"Total: ${order.total}\n\n"
                        f"Reason:\n{reason}\n\n"
                        f"Process the refund in the Stripe dashboard if approved."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=staff_emails,
                )
            except Exception:
                logger.exception("Failed to send refund request email for order %s", order.id)

        return Response(self.get_serializer(order).data)

    @extend_schema(
        summary="Process a refund (staff only)",
        description="Allows staff to approve and process a refund directly through the Stripe API. Marks order REFUNDED and restocks items.",
        request={"application/json": {"type": "object", "properties": {"amount": {"type": "number", "description": "Optional partial refund amount. If omitted, a full refund is issued."}}}},
        responses={200: OrderSerializer},
        tags=["orders"],
    )
    @action(detail=True, methods=["post"], url_path="process-refund", permission_classes=[permissions.IsAdminUser])
    def process_refund(self, request, pk=None):
        from decimal import Decimal, InvalidOperation
        order = self.get_object()

        # Parse and validate the optional partial-refund amount before acquiring
        # the DB lock so we don't hold a row lock during input validation.
        amount = request.data.get("amount")
        refund_kwargs = {}
        if amount is not None:
            try:
                amount_decimal = Decimal(str(amount))
                if amount_decimal <= 0 or amount_decimal > order.total:
                    raise ValueError()
                refund_kwargs["amount"] = int(amount_decimal * 100)
            except (ValueError, InvalidOperation):
                return Response(
                    {"detail": f"Invalid refund amount. Must be a positive number up to the order total (${order.total})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Lock the order row to prevent a concurrent webhook (charge.refunded)
        # from also restocking inventory, which would double-count stock.
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    pk=order.pk,
                    status__in=(Order.Status.PAID, Order.Status.SHIPPED, Order.Status.DELIVERED),
                )
                .first()
            )
            if order is None:
                return Response(
                    {"detail": "Order already refunded or cancelled."},
                    status=status.HTTP_409_CONFLICT,
                )

            if order.stripe_payment_intent:
                try:
                    stripe.Refund.create(
                        payment_intent=order.stripe_payment_intent,
                        **refund_kwargs
                    )
                except stripe.error.StripeError as exc:
                    logger.exception("Stripe refund failed for order %s", order.id)
                    return Response(
                        {"detail": f"Stripe refund failed: {exc.user_message or str(exc)}"},
                        status=status.HTTP_424_FAILED_DEPENDENCY,
                    )

            order.restock()
            order.status = Order.Status.REFUNDED
            order.save(update_fields=["status"])

        return Response(self.get_serializer(order).data)

    @extend_schema(
        summary="Update order status (staff only)",
        description="Allows staff to advance an order through PAID → SHIPPED → DELIVERED, or cancel any non-refunded order.",
        request={"application/json": {"type": "object", "properties": {"status": {"type": "string"}}, "required": ["status"]}},
        responses={200: OrderSerializer},
        tags=["orders"],
    )
    @action(detail=True, methods=["patch"], url_path="status", permission_classes=[permissions.IsAdminUser])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status", "").lower()

        valid_statuses = {s.value for s in Order.Status}
        if new_status not in valid_statuses:
            return Response(
                {"detail": f"Invalid status. Choose from: {', '.join(valid_statuses)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Define allowed transitions for safety.
        allowed_transitions = {
            Order.Status.PAID: [Order.Status.SHIPPED, Order.Status.CANCELLED],
            Order.Status.SHIPPED: [Order.Status.DELIVERED, Order.Status.CANCELLED],
        }

        # Lock the order row to prevent a concurrent webhook from changing
        # status between our check and save (e.g. webhook sets REFUNDED while
        # staff tries to set SHIPPED).
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=order.pk)
            current = order.status
            allowed = allowed_transitions.get(current, [])
            if Order.Status(new_status) not in allowed:
                return Response(
                    {"detail": f"Cannot transition from '{current}' to '{new_status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order.status = new_status
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

    # Security check: verify the paid amount matches our order total.
    # Prevents processing a payment for a different amount than expected.
    order = Order.objects.filter(pk=order_id).first()
    if not order:
        logger.error("Stripe session %s matched non-existent order %s", session.get("id"), order_id)
        return

    # Stripe amounts are in cents.
    expected_cents = int(order.total * 100)
    actual_cents = session.get("amount_total")
    if actual_cents != expected_cents:
        logger.critical(
            "Payment amount mismatch for order %s: expected %s cents, got %s",
            order_id, expected_cents, actual_cents
        )
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


class GuestOrderLookupView(APIView):
    """Look up a guest order by email + order number (first 8 chars of UUID)."""
    permission_classes = [AllowAny]
    throttle_classes = [OrderLookupThrottle]

    @extend_schema(
        summary="Guest order lookup",
        tags=["orders"],
        responses={200: OrderSerializer},
    )
    def get(self, request):
        email = request.query_params.get("email", "").strip().lower()
        order_number = request.query_params.get("order_number", "").strip().upper()
        if not email or not order_number:
            return Response({"detail": "email and order_number are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Search all guest orders for this email, not just the most recent one.
        # Match against the full UUID or the 8-char short form.
        orders = Order.objects.filter(
            guest_email__iexact=email, user=None
        ).prefetch_related("items__product")

        order = None
        for o in orders:
            if (
                str(o.order_number).upper() == order_number
                or str(o.order_number)[:8].upper() == order_number
            ):
                order = o
                break

        if not order:
            return Response({"detail": "No order found with that email and order number."}, status=status.HTTP_404_NOT_FOUND)

        return Response(OrderSerializer(order).data)


class GuestCheckoutView(APIView):
    """Create an order for a guest (no account required).

    The guest submits their cart items in the request body along with a valid
    email and shipping details. Returns the Stripe Checkout URL so the frontend
    can redirect immediately without a second request.
    """
    permission_classes = [AllowAny]
    throttle_classes = [OrderWriteThrottle, OrderVelocityThrottle]

    @extend_schema(
        request=GuestCheckoutSerializer,
        responses={201: {"type": "object", "properties": {"url": {"type": "string"}, "order_id": {"type": "integer"}}}},
        summary="Guest checkout",
        description="Place an order and get a Stripe Checkout URL without an account.",
        tags=["orders"],
    )
    def post(self, request):
        ser = GuestCheckoutSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            coupon = resolve_coupon(data.get("coupon_code", ""))
        except CheckoutError as e:
            return Response({"detail": e.detail}, status=e.status_code)

        try:
            order, order_items = create_order_and_items(
                order_kwargs={
                    "user": None,
                    "guest_email": data["guest_email"],
                    "shipping_full_name": data["shipping_full_name"],
                    "shipping_address": data["shipping_address"],
                    "shipping_city": data["shipping_city"],
                    "shipping_postal_code": data["shipping_postal_code"],
                    "shipping_country": data["shipping_country"],
                },
                items=data["items"],
                coupon=coupon,
            )
        except CheckoutError as e:
            return Response({"detail": e.detail}, status=e.status_code)

        frontend_base = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else "http://localhost:3000"
        line_items = build_stripe_line_items(order_items, order.shipping_cost, order.tax_amount)
        session_kwargs = {
            "payment_method_types": ["card"],
            "line_items": line_items,
            "mode": "payment",
            "customer_email": order.guest_email,
            "success_url": f"{frontend_base}/orders?placed={order.id}&paid=1",
            "cancel_url": f"{frontend_base}/checkout",
            "metadata": {"order_id": order.id},
            "payment_intent_data": {"metadata": {"order_id": order.id}},
        }
        # The order + stock decrement are already committed. Guard the Stripe
        # calls so a provider error/timeout doesn't strand a reserved-stock
        # PENDING order (and a misleading confirmation email): on failure we
        # release the order and return a clean 502 the client can retry.
        try:
            if order.discount > 0:
                stripe_coupon = stripe.Coupon.create(
                    amount_off=int(order.discount * 100),
                    currency="usd",
                    duration="once",
                    name=f"Discount for Order {order.order_number_short}",
                )
                session_kwargs["discounts"] = [{"coupon": stripe_coupon.id}]

            session = stripe.checkout.Session.create(**session_kwargs)
        except stripe.error.StripeError:
            logger.exception(
                "Stripe checkout session creation failed for guest order %s", order.id
            )
            _release_pending_order(order.id)
            return Response(
                {"detail": "Unable to reach the payment provider. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        Order.objects.filter(pk=order.pk).update(stripe_session_id=session.id)
        # Only confirm the order once it's actually payable.
        send_order_confirmation_task.delay(order.id)
        return Response({"url": session.url, "order_id": order.id}, status=status.HTTP_201_CREATED)


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
