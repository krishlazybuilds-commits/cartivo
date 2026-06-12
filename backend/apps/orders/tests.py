from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Category, Product
from apps.orders.models import Order, StripeEvent

User = get_user_model()

SHIPPING = {
    "shipping_full_name": "Ada Lovelace",
    "shipping_address": "1 Analytical Engine Way",
    "shipping_city": "London",
    "shipping_postal_code": "EC1A",
    "shipping_country": "UK",
}


class CheckoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="buyer", password="pass12345")
        self.category = Category.objects.create(name="Gadgets")
        self.product = Product.objects.create(
            category=self.category,
            name="Widget",
            price=Decimal("10.00"),
            stock=5,
            sku="WID-1",
        )
        self.client.force_authenticate(self.user)

    def _add_to_cart(self, quantity):
        cart, _ = Cart.objects.get_or_create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=quantity)

    def test_successful_checkout_creates_order_and_decrements_stock(self):
        self._add_to_cart(2)
        res = self.client.post("/api/orders/", SHIPPING, format="json")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "pending")
        self.assertEqual(Decimal(res.data["total"]), Decimal("20.00"))

        # Stock decremented.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

        # Cart emptied.
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 0)

        # Order persisted with one item.
        order = Order.objects.get(user=self.user)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().unit_price, Decimal("10.00"))

    def test_checkout_with_empty_cart_returns_400(self):
        res = self.client.post("/api/orders/", SHIPPING, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_checkout_insufficient_stock_returns_400_and_no_side_effects(self):
        self._add_to_cart(10)  # only 5 in stock
        res = self.client.post("/api/orders/", SHIPPING, format="json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # No order created, stock unchanged, cart intact.
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 1)

    def test_checkout_requires_shipping_fields(self):
        self._add_to_cart(1)
        res = self.client.post("/api/orders/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_requires_authentication(self):
        # Guest checkout is no longer supported — placing an order requires auth.
        self.client.force_authenticate(None)
        res = self.client.post("/api/orders/", SHIPPING, format="json")
        self.assertIn(
            res.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertEqual(Order.objects.count(), 0)

    def test_users_only_see_their_own_orders(self):
        self._add_to_cart(1)
        self.client.post("/api/orders/", SHIPPING, format="json")

        other = User.objects.create_user(username="other", password="pass12345")
        self.client.force_authenticate(other)
        res = self.client.get("/api/orders/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 0)


class CancelOrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="canceller", password="pass12345")
        self.category = Category.objects.create(name="Gizmos")
        self.product = Product.objects.create(
            category=self.category,
            name="Gizmo",
            price=Decimal("15.00"),
            stock=5,
            sku="GIZ-1",
        )
        self.client.force_authenticate(self.user)

    def _place_order(self, quantity=2):
        cart, _ = Cart.objects.get_or_create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=quantity)
        res = self.client.post("/api/orders/", SHIPPING, format="json")
        return res.data["id"]

    def test_cancel_pending_order_restocks_and_updates_status(self):
        order_id = self._place_order(2)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)  # 5 - 2

        res = self.client.post(f"/api/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "cancelled")

        # Stock restored.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_cannot_cancel_twice(self):
        order_id = self._place_order(1)
        self.client.post(f"/api/orders/{order_id}/cancel/", format="json")

        res = self.client.post(f"/api/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Stock not double-restocked.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_cannot_cancel_another_users_order(self):
        order_id = self._place_order(1)
        other = User.objects.create_user(username="intruder", password="pass12345")
        self.client.force_authenticate(other)
        res = self.client.post(f"/api/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class ExpirePendingOrdersCommandTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="staleuser", password="pass12345")
        self.category = Category.objects.create(name="Widgets")
        self.product = Product.objects.create(
            category=self.category,
            name="Widget",
            price=Decimal("10.00"),
            stock=5,
            sku="WID-X",
        )
        self.client.force_authenticate(self.user)

    def _place_order(self, quantity=2):
        cart, _ = Cart.objects.get_or_create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=quantity)
        res = self.client.post("/api/orders/", SHIPPING, format="json")
        return res.data["id"]

    def _backdate(self, order_id, minutes):
        from django.utils import timezone
        # created_at uses auto_now_add, so set it directly via queryset.
        Order.objects.filter(pk=order_id).update(
            created_at=timezone.now() - timezone.timedelta(minutes=minutes)
        )

    def test_expires_and_restocks_stale_pending_order(self):
        from django.core.management import call_command

        order_id = self._place_order(2)
        self._backdate(order_id, minutes=60)

        call_command("expire_pending_orders", "--minutes", "30")

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)  # restocked

    def test_does_not_expire_recent_pending_order(self):
        from django.core.management import call_command

        order_id = self._place_order(2)  # created just now

        call_command("expire_pending_orders", "--minutes", "30")

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)  # still reserved

    def test_dry_run_changes_nothing(self):
        from django.core.management import call_command

        order_id = self._place_order(2)
        self._backdate(order_id, minutes=60)

        call_command("expire_pending_orders", "--minutes", "30", "--dry-run")

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)  # unchanged


class StripeWebhookIdempotencyTests(APITestCase):
    """The webhook must tolerate Stripe's at-least-once / retry delivery."""

    WEBHOOK_URL = "/api/orders/webhook/"

    def setUp(self):
        self.user = User.objects.create_user(username="payer", password="pass12345")
        self.category = Category.objects.create(name="Things")
        self.product = Product.objects.create(
            category=self.category,
            name="Thing",
            price=Decimal("10.00"),
            stock=5,
            sku="THG-1",
        )

    def _pending_order(self):
        return Order.objects.create(
            user=self.user,
            total=Decimal("10.00"),
            **SHIPPING,
        )

    @staticmethod
    def _event(order_id, event_id="evt_1", event_type="checkout.session.completed"):
        return {
            "id": event_id,
            "type": event_type,
            "data": {"object": {"metadata": {"order_id": str(order_id)}}},
        }

    def _post(self, event):
        from unittest.mock import patch

        with patch(
            "apps.orders.views.stripe.Webhook.construct_event", return_value=event
        ):
            return self.client.post(
                self.WEBHOOK_URL, data="{}", content_type="application/json"
            )

    def test_first_delivery_marks_paid_and_sends_email_once(self):
        from unittest.mock import patch

        order = self._pending_order()
        with patch("apps.orders.views.send_payment_confirmed_task.delay") as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                res = self._post(self._event(order.id))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(mock_email.call_count, 1)
        self.assertEqual(StripeEvent.objects.filter(event_id="evt_1").count(), 1)

    def test_duplicate_event_is_ignored(self):
        from unittest.mock import patch

        order = self._pending_order()
        event = self._event(order.id)
        with patch("apps.orders.views.send_payment_confirmed_task.delay") as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                self._post(event)
            # Same event_id delivered again (Stripe retry).
            with self.captureOnCommitCallbacks(execute=True):
                res = self._post(event)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.json().get("duplicate"))
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        # Email sent only on the first delivery.
        self.assertEqual(mock_email.call_count, 1)
        self.assertEqual(StripeEvent.objects.count(), 1)

    def test_invalid_signature_returns_400_and_records_nothing(self):
        from unittest.mock import patch

        order = self._pending_order()
        with patch(
            "apps.orders.views.stripe.Webhook.construct_event",
            side_effect=ValueError("bad sig"),
        ):
            res = self.client.post(
                self.WEBHOOK_URL, data="{}", content_type="application/json"
            )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(StripeEvent.objects.count(), 0)

    def test_unhandled_event_type_is_recorded_and_acknowledged(self):
        res = self._post(
            self._event(0, event_id="evt_payment", event_type="payment_intent.created")
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            StripeEvent.objects.filter(event_id="evt_payment").count(), 1
        )

    def test_get_request_is_rejected(self):
        res = self.client.get(self.WEBHOOK_URL)
        self.assertEqual(res.status_code, 405)
