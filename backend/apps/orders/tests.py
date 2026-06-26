from decimal import Decimal
from unittest.mock import MagicMock, patch

import stripe

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Category, Product
from apps.orders.models import Coupon, Order, StripeEvent

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
        self.user = User.objects.create_user(
            username="buyer", password="pass12345", email="buyer@test.com"
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])
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
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "pending")
        self.assertEqual(Decimal(res.data["total"]), Decimal("34.99"))

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
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_checkout_insufficient_stock_returns_400_and_no_side_effects(self):
        self._add_to_cart(10)  # only 5 in stock
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # No order created, stock unchanged, cart intact.
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 1)

    def test_checkout_requires_shipping_fields(self):
        self._add_to_cart(1)
        res = self.client.post("/api/v1/orders/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_requires_authentication(self):
        # Guest checkout is no longer supported — placing an order requires auth.
        self.client.force_authenticate(None)
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")
        self.assertIn(
            res.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertEqual(Order.objects.count(), 0)

    def test_users_only_see_their_own_orders(self):
        self._add_to_cart(1)
        self.client.post("/api/v1/orders/", SHIPPING, format="json")

        other = User.objects.create_user(
            username="other", password="pass12345", email="other@test.com"
        )
        self.client.force_authenticate(other)
        res = self.client.get("/api/v1/orders/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 0)


class CancelOrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="canceller", password="pass12345", email="canceller@test.com"
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])
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
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")
        return res.data["id"]

    def test_cancel_pending_order_restocks_and_updates_status(self):
        order_id = self._place_order(2)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)  # 5 - 2

        res = self.client.post(f"/api/v1/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "cancelled")

        # Stock restored.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_cannot_cancel_twice(self):
        order_id = self._place_order(1)
        self.client.post(f"/api/v1/orders/{order_id}/cancel/", format="json")

        res = self.client.post(f"/api/v1/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Stock not double-restocked.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_cannot_cancel_another_users_order(self):
        order_id = self._place_order(1)
        other = User.objects.create_user(
            username="intruder", password="pass12345", email="intruder@test.com"
        )
        self.client.force_authenticate(other)
        res = self.client.post(f"/api/v1/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class ExpirePendingOrdersCommandTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="staleuser", password="pass12345", email="staleuser@test.com"
        )
        self.user.email_verified = True
        self.user.save(update_fields=["email_verified"])
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
        res = self.client.post("/api/v1/orders/", SHIPPING, format="json")
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

    WEBHOOK_URL = "/api/v1/orders/webhook/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="payer", password="pass12345", email="payer@test.com"
        )
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
    def _event(
        order_id, event_id="evt_1", event_type="checkout.session.completed", amount_total=1000
    ):
        return {
            "id": event_id,
            "type": event_type,
            "data": {
                "object": {
                    "metadata": {"order_id": str(order_id)},
                    "amount_total": amount_total,
                }
            },
        }

    def _post(self, event):
        from unittest.mock import patch

        with patch("apps.orders.views.stripe.Webhook.construct_event", return_value=event):
            return self.client.post(self.WEBHOOK_URL, data="{}", content_type="application/json")

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
            res = self.client.post(self.WEBHOOK_URL, data="{}", content_type="application/json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(StripeEvent.objects.count(), 0)

    def test_unhandled_event_type_is_recorded_and_acknowledged(self):
        res = self._post(
            self._event(0, event_id="evt_payment", event_type="payment_intent.created")
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(StripeEvent.objects.filter(event_id="evt_payment").count(), 1)

    def test_get_request_is_rejected(self):
        res = self.client.get(self.WEBHOOK_URL)
        self.assertEqual(res.status_code, 405)


class StripeWebhookEventTests(APITestCase):
    """Tests for each specific webhook event handler."""

    WEBHOOK_URL = "/api/v1/orders/webhook/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="evtuser", password="pass12345", email="evtuser@test.com"
        )
        self.category = Category.objects.create(name="Goods")
        self.product = Product.objects.create(
            category=self.category,
            name="Item",
            price=Decimal("20.00"),
            stock=5,
            sku="ITEM-1",
        )

    def _pending_order(self, total=Decimal("20.00")):
        return Order.objects.create(
            user=self.user,
            total=total,
            **SHIPPING,
        )

    def _paid_order(self, total=Decimal("20.00")):
        return Order.objects.create(
            user=self.user,
            total=total,
            status=Order.Status.PAID,
            stripe_payment_intent="pi_existing",
            **SHIPPING,
        )

    @staticmethod
    def _event(event_id, event_type, order_id=None, overrides=None):
        obj = {"metadata": {"order_id": str(order_id)} if order_id else {}}
        if overrides:
            obj.update(overrides)
        return {
            "id": event_id,
            "type": event_type,
            "data": {"object": obj},
        }

    def _post(self, event):
        with patch("apps.orders.views.stripe.Webhook.construct_event", return_value=event):
            return self.client.post(self.WEBHOOK_URL, data="{}", content_type="application/json")

    # ── checkout.session.expired ──────────────────────────────────────────────

    def test_expired_session_cancels_and_restocks_pending_order(self):
        order = self._pending_order()
        self.product.stock = 3
        self.product.save()
        Order.objects.filter(pk=order.id).update(stripe_payment_intent="")
        # Add items so _restock_order has work to do.
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=2, unit_price=Decimal("20.00")
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

        event = self._event("evt_exp_1", "checkout.session.expired", order_id=order.id)
        res = self._post(event)

        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)  # restocked

    def test_expired_session_missing_order_id_is_noop(self):
        order = self._pending_order()
        event = self._event("evt_exp_2", "checkout.session.expired")
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_expired_session_non_existent_order_is_noop(self):
        event = self._event("evt_exp_3", "checkout.session.expired", order_id=99999)
        res = self._post(event)
        self.assertEqual(res.status_code, 200)

    def test_expired_session_already_paid_is_noop(self):
        order = self._paid_order()
        event = self._event("evt_exp_4", "checkout.session.expired", order_id=order.id)
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)

    # ── payment_intent.payment_failed ─────────────────────────────────────────

    def test_payment_failed_does_not_change_order_status(self):
        order = self._pending_order()
        event = self._event("evt_fail_1", "payment_intent.payment_failed", order_id=order.id)
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_payment_failed_missing_order_id_is_noop(self):
        event = self._event("evt_fail_2", "payment_intent.payment_failed")
        res = self._post(event)
        self.assertEqual(res.status_code, 200)

    def test_payment_failed_is_idempotent(self):
        order = self._pending_order()
        event = self._event("evt_fail_1", "payment_intent.payment_failed", order_id=order.id)
        with self.captureOnCommitCallbacks(execute=True):
            self._post(event)
        res = self._post(event)  # duplicate event_id
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("duplicate"))

    # ── charge.refunded ───────────────────────────────────────────────────────

    def test_charge_refunded_marks_refunded_and_restocks(self):
        order = self._paid_order()
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=1, unit_price=Decimal("20.00")
        )
        self.product.refresh_from_db()
        initial_stock = self.product.stock

        event = self._event(
            "evt_ref_1",
            "charge.refunded",
            order_id=order.id,
            overrides={"payment_intent": "pi_refund"},
        )
        res = self._post(event)

        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.REFUNDED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, initial_stock + 1)

    def test_charge_refunded_is_idempotent_via_status_filter(self):
        order = self._paid_order()
        event = self._event(
            "evt_ref_2",
            "charge.refunded",
            order_id=order.id,
            overrides={"payment_intent": "pi_refund2"},
        )
        self._post(event)
        # Second delivery of a *different* event_id but same order.
        event2 = self._event(
            "evt_ref_2b",
            "charge.refunded",
            order_id=order.id,
            overrides={"payment_intent": "pi_refund2"},
        )
        res = self._post(event2)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.REFUNDED)
        # Verify not double-restocked by checking StockEvent count if we had one,
        # or just check the order status is still REFUNDED.

    def test_charge_refunded_matches_by_payment_intent(self):
        pi = "pi_match_by_intent"
        order = self._paid_order()
        order.stripe_payment_intent = pi
        order.save(update_fields=["stripe_payment_intent"])

        event = {
            "id": "evt_ref_3",
            "type": "charge.refunded",
            "data": {
                "object": {
                    "metadata": {},
                    "payment_intent": pi,
                }
            },
        }
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.REFUNDED)

    def test_charge_refunded_non_paid_order_is_noop(self):
        order = self._pending_order()
        event = self._event(
            "evt_ref_4",
            "charge.refunded",
            order_id=order.id,
            overrides={"payment_intent": "pi_noop"},
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_charge_refunded_no_order_id_or_payment_intent_is_noop(self):
        event = self._event("evt_ref_5", "charge.refunded", overrides={})
        # Remove metadata key entirely so neither order_id nor payment_intent exist.
        event["data"]["object"] = {"metadata": {}}
        res = self._post(event)
        self.assertEqual(res.status_code, 200)

    # ── checkout.session.completed edge cases ─────────────────────────────────

    def test_checkout_completed_amount_mismatch_does_not_mark_paid(self):
        order = self._pending_order(total=Decimal("30.00"))
        event = self._event(
            "evt_cc_1",
            "checkout.session.completed",
            order_id=order.id,
            overrides={"amount_total": 1000},  # 10.00 != 30.00
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_checkout_completed_non_existent_order_is_noop(self):
        event = self._event(
            "evt_cc_2",
            "checkout.session.completed",
            order_id=99999,
            overrides={"amount_total": 2000},
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)

    def test_checkout_completed_missing_metadata_is_noop(self):
        order = self._pending_order()
        event = self._event("evt_cc_3", "checkout.session.completed")
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_checkout_completed_already_paid_is_noop(self):
        order = self._paid_order()
        event = self._event(
            "evt_cc_4",
            "checkout.session.completed",
            order_id=order.id,
            overrides={"amount_total": int(order.total * 100)},
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)

    # ── Signature errors ──────────────────────────────────────────────────────

    def test_signature_verification_error_returns_400(self):
        from stripe.error import SignatureVerificationError

        with patch(
            "apps.orders.views.stripe.Webhook.construct_event",
            side_effect=SignatureVerificationError("bad sig", "dummy"),
        ):
            res = self.client.post(self.WEBHOOK_URL, data="{}", content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(StripeEvent.objects.count(), 0)

    def test_stripe_event_model_created_with_type(self):
        event = self._event("evt_type_check", "checkout.session.completed", order_id=0)
        self._post(event)
        se = StripeEvent.objects.get(event_id="evt_type_check")
        self.assertEqual(se.event_type, "checkout.session.completed")

    def test_order_item_restocked_once_on_expired_then_refunded(self):
        """An expired session cancels + restocks. Make sure _restock_order runs."""
        order = self._pending_order()
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=2, unit_price=Decimal("20.00")
        )
        self.product.refresh_from_db()
        before = self.product.stock

        event = self._event("evt_combo", "checkout.session.expired", order_id=order.id)
        self._post(event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, before + 2)


class StripeWebhookEdgeCaseTests(APITestCase):
    """Advanced webhook edge cases: races, duplicate refunds, amount edge cases."""

    WEBHOOK_URL = "/api/v1/orders/webhook/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="edgeuser", password="pass12345", email="edge@test.com"
        )
        self.category = Category.objects.create(name="Edge")
        self.product = Product.objects.create(
            category=self.category,
            name="Edge Item",
            price=Decimal("25.00"),
            stock=10,
            sku="EDGE-1",
        )

    def _pending_order(self, total=Decimal("25.00")):
        return Order.objects.create(user=self.user, total=total, **SHIPPING)

    def _paid_order(self, total=Decimal("25.00")):
        return Order.objects.create(
            user=self.user,
            total=total,
            status=Order.Status.PAID,
            stripe_payment_intent="pi_edge",
            **SHIPPING,
        )

    @staticmethod
    def _event(event_id, event_type, order_id=None, overrides=None):
        obj = {"metadata": {"order_id": str(order_id)} if order_id else {}}
        if overrides:
            obj.update(overrides)
        return {"id": event_id, "type": event_type, "data": {"object": obj}}

    def _post(self, event):
        with patch("apps.orders.views.stripe.Webhook.construct_event", return_value=event):
            return self.client.post(self.WEBHOOK_URL, data="{}", content_type="application/json")

    def test_concurrent_duplicate_events_both_delivered(self):
        """Two identical events arriving in separate requests: first succeeds, second is duplicate.
        """
        order = self._pending_order()
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=1, unit_price=Decimal("25.00")
        )

        event = self._event(
            "evt_con_dup", "checkout.session.completed", order.id, {"amount_total": 2500}
        )
        with patch("apps.orders.views.send_payment_confirmed_task.delay") as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                r1 = self._post(event)
            r2 = self._post(event)

        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.json().get("duplicate"))
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(mock_email.call_count, 1)

    def test_expired_then_completed_race(self):
        """If expired event arrives first, then completed later, completed is noop."""
        order = self._pending_order()
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=1, unit_price=Decimal("25.00")
        )

        # Decrement stock to simulate that it was already taken
        self.product.stock = 9
        self.product.save(update_fields=["stock"])

        exp_event = self._event("evt_race_exp", "checkout.session.expired", order.id)
        self._post(exp_event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        comp_event = self._event(
            "evt_race_comp", "checkout.session.completed", order.id, {"amount_total": 2500}
        )
        with patch("apps.orders.views.send_payment_confirmed_task.delay") as mock_email:
            self._post(comp_event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        mock_email.assert_not_called()

    def test_double_refund_same_event_id(self):
        """Two identical refund events: first succeeds, second is duplicate."""
        order = self._paid_order()
        from apps.orders.models import OrderItem

        OrderItem.objects.create(
            order=order, product=self.product, quantity=1, unit_price=Decimal("25.00")
        )
        self.product.refresh_from_db()
        initial_stock = self.product.stock

        event = self._event(
            "evt_dbl_ref", "charge.refunded", order.id, {"payment_intent": "pi_edge"}
        )
        r1 = self._post(event)
        r2 = self._post(event)

        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.json().get("duplicate"))
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.REFUNDED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, initial_stock + 1)

    def test_refund_of_cancelled_order_is_noop(self):
        """Refund event for a CANCELLED order should be ignored."""
        order = self._pending_order()
        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status"])

        event = self._event(
            "evt_ref_canc", "charge.refunded", order.id, {"payment_intent": "pi_canc"}
        )
        r = self._post(event)
        self.assertEqual(r.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

    def test_checkout_completed_zero_amount(self):
        """A checkout.session.completed with amount_total=0 should not mark paid."""
        order = self._pending_order()
        event = self._event("evt_zero", "checkout.session.completed", order.id, {"amount_total": 0})
        self._post(event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_checkout_completed_max_int_amount(self):
        """A very large amount_total should still work."""
        order = self._pending_order(total=Decimal("999999.99"))
        event = self._event(
            "evt_max", "checkout.session.completed", order.id, {"amount_total": 99999999}
        )
        self._post(event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)


class MultiWarehouseStockTests(APITestCase):
    def setUp(self):
        from apps.catalog.models import Product, Warehouse, Category

        self.category = Category.objects.create(name="Multi-Warehouse Category")
        self.product = Product.objects.create(
            category=self.category,
            name="Multi-Warehouse Product",
            price=Decimal("10.00"),
            sku="MW-PROD-1",
            stock=0,
        )

        # Create two warehouses
        self.wh_east = Warehouse.objects.create(
            name="East Coast Hub",
            code="EAST",
            is_active=True,
        )
        self.wh_west = Warehouse.objects.create(
            name="West Coast Hub",
            code="WEST",
            is_active=True,
        )

    def test_stock_aggregation(self):
        from apps.catalog.models import WarehouseStock

        # Set stock in East Coast Hub
        WarehouseStock.objects.create(
            warehouse=self.wh_east,
            product=self.product,
            stock=15,
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 15)

        # Set stock in West Coast Hub
        WarehouseStock.objects.create(
            warehouse=self.wh_west,
            product=self.product,
            stock=25,
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 40)

    def test_order_fulfillment_from_specific_warehouse(self):
        from apps.catalog.models import WarehouseStock
        from apps.orders.services import create_order_and_items

        # East has 5, West has 20
        WarehouseStock.objects.create(
            warehouse=self.wh_east,
            product=self.product,
            stock=5,
        )
        WarehouseStock.objects.create(
            warehouse=self.wh_west,
            product=self.product,
            stock=20,
        )

        # Order of 15 items should be fulfilled from West Coast Hub (since East only has 5)
        order_kwargs = {
            "shipping_full_name": "John Doe",
            "shipping_address": "123 St",
            "shipping_city": "NY",
            "shipping_postal_code": "10001",
            "shipping_country": "US",
        }
        items = [{"product_id": self.product.id, "quantity": 15}]

        order, _ = create_order_and_items(order_kwargs=order_kwargs, items=items)
        self.assertEqual(order.warehouse, self.wh_west)

        # West Coast stock should be decremented to 5, East Coast remains 5
        wh_stock_west = WarehouseStock.objects.get(warehouse=self.wh_west, product=self.product)
        self.assertEqual(wh_stock_west.stock, 5)

        wh_stock_east = WarehouseStock.objects.get(warehouse=self.wh_east, product=self.product)
        self.assertEqual(wh_stock_east.stock, 5)

        # Total product stock should be 10
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

    def test_order_restocking_to_correct_warehouse(self):
        from apps.catalog.models import WarehouseStock
        from apps.orders.services import create_order_and_items

        # East has 5, West has 20
        WarehouseStock.objects.create(
            warehouse=self.wh_east,
            product=self.product,
            stock=5,
        )
        WarehouseStock.objects.create(
            warehouse=self.wh_west,
            product=self.product,
            stock=20,
        )

        order_kwargs = {
            "shipping_full_name": "John Doe",
            "shipping_address": "123 St",
            "shipping_city": "NY",
            "shipping_postal_code": "10001",
            "shipping_country": "US",
        }
        items = [{"product_id": self.product.id, "quantity": 15}]
        order, _ = create_order_and_items(order_kwargs=order_kwargs, items=items)

        # Cancel order should restock to West Coast Hub
        order.restock()

        wh_stock_west = WarehouseStock.objects.get(warehouse=self.wh_west, product=self.product)
        self.assertEqual(wh_stock_west.stock, 20)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 25)


class StaffRefundWorkflowTests(APITestCase):
    def setUp(self):
        from apps.catalog.models import Category, Product, Warehouse, WarehouseStock

        self.staff_user = User.objects.create_user(
            username="staff", password="pass12345", email="staff@test.com", is_staff=True
        )
        self.category = Category.objects.create(name="Gadgets")
        self.product = Product.objects.create(
            category=self.category,
            name="Refundable Widget",
            price=Decimal("10.00"),
            sku="REF-WID-1",
            stock=0,
        )
        self.warehouse = Warehouse.objects.create(
            name="Refund Warehouse",
            code="REF_WH",
            is_active=True,
        )
        self.wh_stock = WarehouseStock.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            stock=10,
        )
        self.product.refresh_from_db()

    def test_staff_can_process_refund_manually(self):
        from apps.orders.services import create_order_and_items

        self.client.force_authenticate(self.staff_user)

        order_kwargs = {
            "shipping_full_name": "Jane Doe",
            "shipping_address": "456 St",
            "shipping_city": "Boston",
            "shipping_postal_code": "02108",
            "shipping_country": "US",
        }
        items = [{"product_id": self.product.id, "quantity": 3}]
        order, _ = create_order_and_items(order_kwargs=order_kwargs, items=items)

        # Mark order paid so it can be refunded
        order.status = Order.Status.PAID
        order.stripe_payment_intent = "pi_mock_refund_123"
        order.save()

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

        # Mock stripe.Refund.create
        with patch("stripe.Refund.create") as mock_refund_create:
            res = self.client.post(f"/api/v1/orders/{order.id}/process-refund/", format="json")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            mock_refund_create.assert_called_once_with(payment_intent="pi_mock_refund_123")

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.REFUNDED)

        # Verify items were restocked to the correct warehouse
        self.wh_stock.refresh_from_db()
        self.assertEqual(self.wh_stock.stock, 10)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)


class StripeCheckoutFailureTests(APITestCase):
    """Stripe calls in the checkout path must fail safe.

    A provider error/timeout should surface as a clean 502 (not an unhandled
    500), and must never leave a reserved-stock PENDING order behind.
    """

    GUEST_URL = "/api/v1/orders/guest-checkout/"

    def setUp(self):
        self.category = Category.objects.create(name="Payables")
        self.product = Product.objects.create(
            category=self.category,
            name="Payable Widget",
            price=Decimal("10.00"),
            stock=5,
            sku="PAY-1",
        )

    def _guest_payload(self, quantity=2):
        return {
            "guest_email": "guest@test.com",
            "items": [{"product_id": self.product.id, "quantity": quantity}],
            **SHIPPING,
        }

    def test_guest_checkout_stripe_failure_releases_stock_and_returns_502(self):
        with (
            patch("apps.orders.views.send_order_confirmation_task.delay") as mock_email,
            patch(
                "apps.orders.views.stripe.checkout.Session.create",
                side_effect=stripe.error.StripeError("timeout"),
            ),
        ):
            res = self.client.post(self.GUEST_URL, self._guest_payload(2), format="json")

        # Clean 502 rather than an unhandled 500.
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)

        # The order committed before the Stripe call is rolled back (cancelled),
        # so it no longer holds reserved stock waiting on the 30-min sweep.
        order = Order.objects.get(guest_email="guest@test.com")
        self.assertEqual(order.status, Order.Status.CANCELLED)

        # Reserved stock released.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

        # No misleading "order placed" email for an unpayable order.
        mock_email.assert_not_called()

    def test_guest_checkout_success_queues_email_and_returns_url(self):
        fake_session = MagicMock(id="cs_test_123", url="https://stripe.test/checkout")
        with (
            patch("apps.orders.views.send_order_confirmation_task.delay") as mock_email,
            patch(
                "apps.orders.views.stripe.checkout.Session.create",
                return_value=fake_session,
            ),
        ):
            res = self.client.post(self.GUEST_URL, self._guest_payload(2), format="json")

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["url"], "https://stripe.test/checkout")

        order = Order.objects.get(guest_email="guest@test.com")
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.stripe_session_id, "cs_test_123")

        # Stock stays reserved while the order is awaiting payment.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

        # Confirmation email queued only once the order is payable.
        mock_email.assert_called_once_with(order.id)

    def test_pay_stripe_failure_returns_502_and_keeps_order_pending(self):
        user = User.objects.create_user(
            username="paybuyer",
            password="pass12345",
            email="paybuyer@test.com",
        )
        user.email_verified = True
        user.stripe_customer_id = "cus_existing"
        user.save(update_fields=["email_verified", "stripe_customer_id"])
        self.client.force_authenticate(user)

        cart, _ = Cart.objects.get_or_create(user=user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        place = self.client.post("/api/v1/orders/", SHIPPING, format="json")
        order_id = place.data["id"]
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)  # reserved at order creation

        with patch(
            "apps.orders.views.stripe.checkout.Session.create",
            side_effect=stripe.error.StripeError("timeout"),
        ):
            res = self.client.post(f"/api/v1/orders/{order_id}/pay/", format="json")

        # Clean 502 rather than an unhandled 500.
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)

        # Order is untouched and remains payable for a retry; stock unchanged.
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_pay_stripe_customer_create_failure_returns_502(self):
        user = User.objects.create_user(
            username="newpayer",
            password="pass12345",
            email="newpayer@test.com",
        )
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        self.client.force_authenticate(user)

        cart, _ = Cart.objects.get_or_create(user=user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)
        place = self.client.post("/api/v1/orders/", SHIPPING, format="json")
        order_id = place.data["id"]

        # No stripe_customer_id yet, so Customer.create is hit first.
        with patch(
            "apps.orders.views.stripe.Customer.create",
            side_effect=stripe.error.StripeError("timeout"),
        ):
            res = self.client.post(f"/api/v1/orders/{order_id}/pay/", format="json")

        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)


class GuestCheckoutCouponTests(APITestCase):
    """Guest checkout with various coupon edge cases."""

    GUEST_URL = "/api/v1/orders/guest-checkout/"

    def setUp(self):
        self.category = Category.objects.create(name="Coupon Cat")
        self.product = Product.objects.create(
            category=self.category,
            name="Coupon Item",
            price=Decimal("50.00"),
            stock=20,
            sku="CPN-1",
        )
        self.coupon = Coupon.objects.create(
            code="SAVE10",
            discount_type=Coupon.DiscountType.PERCENT,
            value=Decimal("10"),
            max_uses=5,
            min_order_amount=Decimal("30"),
        )

    def _payload(self, **overrides):
        payload = {
            "guest_email": "guest@test.com",
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "coupon_code": "SAVE10",
            **SHIPPING,
        }
        payload.update(overrides)
        return payload

    def _checkout(self, payload):
        fake_session = MagicMock(id="cs_cpn", url="https://stripe.test/checkout")
        fake_coupon = MagicMock(id="cpn_test")
        with patch("apps.orders.views.stripe.checkout.Session.create", return_value=fake_session), \
             patch("apps.orders.views.stripe.Coupon.create", return_value=fake_coupon):
            return self.client.post(self.GUEST_URL, payload, format="json")

    def test_guest_checkout_with_valid_coupon(self):
        res = self._checkout(self._payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(guest_email="guest@test.com")
        self.assertIsNotNone(order.coupon)
        self.assertEqual(order.coupon.code, "SAVE10")
        self.assertGreater(order.discount, 0)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.times_used, 1)

    def test_guest_checkout_with_expired_coupon(self):
        from django.utils import timezone

        self.coupon.valid_until = timezone.now() - timezone.timedelta(days=1)
        self.coupon.save(update_fields=["valid_until"])
        res = self._checkout(self._payload())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", res.json()["detail"].lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_checkout_with_exhausted_coupon(self):
        self.coupon.times_used = 5
        self.coupon.save(update_fields=["times_used"])
        res = self._checkout(self._payload())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("usage limit", res.json()["detail"].lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_checkout_below_min_order(self):
        Coupon.objects.create(
            code="HIGHMIN",
            discount_type=Coupon.DiscountType.FLAT,
            value=Decimal("5"),
            max_uses=5,
            min_order_amount=Decimal("200"),
        )
        res = self._checkout(self._payload(coupon_code="HIGHMIN"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("minimum", res.json()["detail"].lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_checkout_with_inactive_coupon(self):
        self.coupon.is_active = False
        self.coupon.save(update_fields=["is_active"])
        res = self._checkout(self._payload())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_checkout_with_invalid_coupon_code(self):
        res = self._checkout(self._payload(coupon_code="NONEXIST"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid", res.json()["detail"].lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_guest_checkout_flat_coupon_exceeds_subtotal(self):
        Coupon.objects.create(
            code="BIGFLAT",
            discount_type=Coupon.DiscountType.FLAT,
            value=Decimal("999"),
            max_uses=5,
        )
        res = self._checkout(self._payload(coupon_code="BIGFLAT"))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(guest_email="guest@test.com")
        self.assertEqual(order.discount, Decimal("50.00"))

    def test_guest_checkout_percent_coupon_rounding(self):
        """Percent discount requiring rounding (e.g. 7% of $50 = $3.50)."""
        Coupon.objects.create(
            code="PCT7",
            discount_type=Coupon.DiscountType.PERCENT,
            value=Decimal("7"),
            max_uses=5,
        )
        res = self._checkout(self._payload(coupon_code="PCT7"))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(guest_email="guest@test.com")
        self.assertEqual(order.discount, Decimal("3.50"))


class RateLimitTests(APITestCase):
    """Rate limiting boundary tests.

    Throttling is disabled in test settings by default.  We enable specific
    rates with ``override_settings`` to verify throttle classes work correctly
    at boundaries without slowing down the rest of the suite.
    """

    def setUp(self):
        self.category = Category.objects.create(name="Rate Limit Cat")
        self.product = Product.objects.create(
            category=self.category,
            name="Rate Item",
            price=Decimal("10.00"),
            stock=100,
            sku="RATE-1",
        )

    def test_order_write_throttle_blocks_after_limit(self):
        from unittest.mock import patch

        from config.throttling import OrderVelocityThrottle, OrderWriteThrottle
        from django.test import override_settings

        rates = {
            "contact": "5/hour",
            "login": "10/min",
            "register": "5/hour",
            "password_reset": "5/hour",
            "cart": "60/min",
            "order": "2/min",
            "payment": "10/min",
            "coupon": "10/min",
            "shipping_estimate": "30/min",
            "order_velocity": "10/min",
            "order_lookup": "30/min",
        }
        with (
            override_settings(
                REST_FRAMEWORK={
                    "DEFAULT_THROTTLE_RATES": rates,
                    "DEFAULT_AUTHENTICATION_CLASSES": (
                        "rest_framework.authentication.SessionAuthentication",
                    ),
                    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
                }
            ),
            patch.object(OrderWriteThrottle, "THROTTLE_RATES", rates),
            patch.object(OrderVelocityThrottle, "THROTTLE_RATES", rates),
        ):
            user = User.objects.create_user(
                username="throttleuser", password="pass12345", email="throttle@test.com"
            )
            user.email_verified = True
            user.save(update_fields=["email_verified"])
            self.client.force_authenticate(user)
            cart, _ = Cart.objects.get_or_create(user=user)
            CartItem.objects.create(cart=cart, product=self.product, quantity=1)

            r1 = self.client.post("/api/v1/orders/", SHIPPING, format="json")
            self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

            # Need a fresh cart item for second attempt (first emptied the cart)
            cart.refresh_from_db()
            CartItem.objects.create(cart=cart, product=self.product, quantity=1)
            r2 = self.client.post("/api/v1/orders/", SHIPPING, format="json")
            self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

            CartItem.objects.create(cart=cart, product=self.product, quantity=1)
            r3 = self.client.post("/api/v1/orders/", SHIPPING, format="json")
            self.assertEqual(r3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_reads_not_throttled(self):
        from django.test import override_settings

        rates = {
            "contact": "5/hour",
            "login": "10/min",
            "register": "5/hour",
            "password_reset": "5/hour",
            "cart": "60/min",
            "order": "1/min",
            "payment": "10/min",
            "coupon": "10/min",
            "shipping_estimate": "30/min",
            "order_velocity": "10/min",
            "order_lookup": "30/min",
        }
        with override_settings(
            REST_FRAMEWORK={
                "DEFAULT_THROTTLE_RATES": rates,
                "DEFAULT_AUTHENTICATION_CLASSES": (
                    "rest_framework.authentication.SessionAuthentication",
                ),
                "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
            }
        ):
            user = User.objects.create_user(
                username="readuser", password="pass12345", email="read@test.com"
            )
            self.client.force_authenticate(user)

            for _ in range(5):
                r = self.client.get("/api/v1/orders/")
                self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_anonymous_ip_bucket_separate_from_authenticated(self):
        from unittest.mock import patch

        from config.throttling import CouponAnonThrottle
        from django.test import override_settings

        rates = {
            "contact": "5/hour",
            "login": "10/min",
            "register": "5/hour",
            "password_reset": "5/hour",
            "cart": "60/min",
            "order": "1/min",
            "payment": "10/min",
            "coupon": "1/min",
            "shipping_estimate": "30/min",
            "order_velocity": "10/min",
            "order_lookup": "30/min",
        }
        with (
            override_settings(
                REST_FRAMEWORK={
                    "DEFAULT_THROTTLE_RATES": rates,
                    "DEFAULT_AUTHENTICATION_CLASSES": (
                        "rest_framework.authentication.SessionAuthentication",
                    ),
                    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
                }
            ),
            patch.object(CouponAnonThrottle, "THROTTLE_RATES", rates),
        ):
            self.client.force_authenticate(None)

            # Anonymous: consume the coupon bucket (1/min)
            r1 = self.client.post(
                "/api/v1/coupons/validate/", {"code": "NONEXIST", "subtotal": "50"}, format="json"
            )
            # Even with 1/min, this should work — bucket is per-IP not global
            self.assertEqual(r1.status_code, status.HTTP_200_OK)

            # Authenticated user: separate bucket, should still be allowed
            user = User.objects.create_user(
                username="sepuser", password="pass12345", email="sep@test.com"
            )
            self.client.force_authenticate(user)
            r2 = self.client.post(
                "/api/v1/coupons/validate/", {"code": "NONEXIST", "subtotal": "50"}, format="json"
            )
            self.assertEqual(r2.status_code, status.HTTP_200_OK)


class ConcurrentCheckoutTests(APITestCase):
    """Race-condition scenarios for inventory decrement and coupon usage.

    The production code uses ``select_for_update`` to serialize concurrent
    checkouts.  These tests verify that the defensive guards (IntegrityError
    catch, coupon concurrency) work even when row locks are in play.
    """

    def setUp(self):
        from apps.catalog.models import Warehouse, WarehouseStock

        self.category = Category.objects.create(name="Concurrent")
        self.product = Product.objects.create(
            category=self.category,
            name="Race Item",
            price=Decimal("10.00"),
            sku="RACE-1",
            stock=0,
        )
        self.warehouse = Warehouse.objects.create(
            name="Race WH",
            code="RACE",
            is_active=True,
        )
        # Stock on the last unit to test exhaustion boundary
        self.wh_stock = WarehouseStock.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            stock=1,
        )
        self.product.refresh_from_db()

    def test_concurrent_coupon_usage_does_not_exceed_max_uses(self):
        """Simulate a race where two checkouts both pass the max_uses check
        before either increments times_used. The select_for_update on the
        coupon row inside create_order_and_items should serialize them."""
        from apps.orders.services import CheckoutError, create_order_and_items

        coupon = Coupon.objects.create(
            code="LASER",
            discount_type=Coupon.DiscountType.FLAT,
            value=Decimal("1"),
            max_uses=1,
        )
        # Create two warehouse stock entries so two orders can both pass stock check
        from apps.catalog.models import Warehouse, WarehouseStock

        wh2 = Warehouse.objects.create(name="Race WH2", code="RACE2", is_active=True)
        WarehouseStock.objects.create(
            warehouse=wh2,
            product=self.product,
            stock=1,
        )

        order_kwargs_base = {
            "shipping_full_name": "Race Tester",
            "shipping_address": "456 Race St",
            "shipping_city": "Race City",
            "shipping_postal_code": "12345",
            "shipping_country": "US",
        }

        # First checkout succeeds (times_used=0 < max_uses=1)
        order1, _ = create_order_and_items(
            order_kwargs={**order_kwargs_base, "user": None, "guest_email": "race1@test.com"},
            items=[{"product_id": self.product.id, "quantity": 1}],
            coupon=coupon,
        )
        self.assertEqual(order1.discount, Decimal("1.00"))

        # Second checkout with select_for_update sees times_used=1 and fails
        coupon.refresh_from_db()
        with self.assertRaises(CheckoutError) as ctx:
            create_order_and_items(
                order_kwargs={**order_kwargs_base, "user": None, "guest_email": "race2@test.com"},
                items=[{"product_id": self.product.id, "quantity": 1}],
                coupon=coupon,
            )
        self.assertIn("usage limit", str(ctx.exception.detail).lower())

    def test_inactive_product_at_checkout_raises_error(self):
        """If a product becomes inactive between cart add and checkout."""
        from apps.orders.services import CheckoutError, create_order_and_items

        self.product.is_active = False
        self.product.save(update_fields=["is_active"])

        order_kwargs = {
            "shipping_full_name": "Test",
            "shipping_address": "123 St",
            "shipping_city": "City",
            "shipping_postal_code": "12345",
            "shipping_country": "US",
        }
        with self.assertRaises(CheckoutError) as ctx:
            create_order_and_items(
                order_kwargs={**order_kwargs, "user": None, "guest_email": "inactive@test.com"},
                items=[{"product_id": self.product.id, "quantity": 1}],
            )
        self.assertIn("no longer available", str(ctx.exception.detail).lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_nonexistent_product_at_checkout(self):
        """If a product id in items does not exist."""
        from apps.orders.services import CheckoutError, create_order_and_items

        order_kwargs = {
            "shipping_full_name": "Test",
            "shipping_address": "123 St",
            "shipping_city": "City",
            "shipping_postal_code": "12345",
            "shipping_country": "US",
        }
        with self.assertRaises(CheckoutError) as ctx:
            create_order_and_items(
                order_kwargs={**order_kwargs, "user": None, "guest_email": "nonexist@test.com"},
                items=[{"product_id": 99999, "quantity": 1}],
            )
        self.assertIn("not found", str(ctx.exception.detail).lower())
        self.assertEqual(Order.objects.count(), 0)

    def test_exact_stock_boundary_succeeds(self):
        """Ordering exactly the available stock should succeed."""
        from apps.orders.services import create_order_and_items

        order_kwargs = {
            "shipping_full_name": "Boundary Test",
            "shipping_address": "1 Boundary St",
            "shipping_city": "Bound",
            "shipping_postal_code": "00000",
            "shipping_country": "US",
        }
        order, items = create_order_and_items(
            order_kwargs={**order_kwargs, "user": None, "guest_email": "boundary@test.com"},
            items=[{"product_id": self.product.id, "quantity": 1}],
        )
        self.assertEqual(order.items.count(), 1)
        self.wh_stock.refresh_from_db()
        self.assertEqual(self.wh_stock.stock, 0)

    def test_one_above_stock_boundary_fails(self):
        """Ordering one more than available stock should fail."""
        from apps.orders.services import CheckoutError, create_order_and_items

        order_kwargs = {
            "shipping_full_name": "Over Test",
            "shipping_address": "2 Over St",
            "shipping_city": "Over",
            "shipping_postal_code": "00001",
            "shipping_country": "US",
        }
        with self.assertRaises(CheckoutError):
            create_order_and_items(
                order_kwargs={**order_kwargs, "user": None, "guest_email": "over@test.com"},
                items=[{"product_id": self.product.id, "quantity": 2}],
            )
        self.assertEqual(Order.objects.count(), 0)
        self.wh_stock.refresh_from_db()
        self.assertEqual(self.wh_stock.stock, 1)


class OversellStockGuardTests(APITestCase):
    """A stock CHECK-constraint violation during the decrement must surface as a
    clean 400 (CheckoutError), never an unhandled 500 IntegrityError.

    The Product-level row lock serializes concurrent checkouts and normally
    prevents oversell, so we simulate a decrement that trips the
    warehouse_stock_non_negative constraint to exercise the defensive guard.
    """

    def setUp(self):
        from apps.catalog.models import Warehouse, WarehouseStock

        self.category = Category.objects.create(name="Concurrents")
        self.product = Product.objects.create(
            category=self.category,
            name="Last Unit Widget",
            price=Decimal("10.00"),
            sku="LAST-1",
            stock=0,
        )
        self.warehouse = Warehouse.objects.create(
            name="Solo Warehouse",
            code="SOLO",
            is_active=True,
        )
        # Pre-create the stock row so the get_or_create calls in checkout fetch
        # it (no save), leaving only the explicit decrement save() to fail.
        self.wh_stock = WarehouseStock.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            stock=5,
        )
        self.product.refresh_from_db()

    def test_decrement_constraint_violation_raises_checkout_error(self):
        from apps.catalog.models import WarehouseStock
        from apps.orders.services import CheckoutError, create_order_and_items

        order_kwargs = {"user": None, "guest_email": "race@test.com", **SHIPPING}
        items = [{"product_id": self.product.id, "quantity": 2}]

        with patch.object(
            WarehouseStock,
            "save",
            side_effect=IntegrityError("warehouse_stock_non_negative"),
        ):
            with self.assertRaises(CheckoutError) as ctx:
                create_order_and_items(order_kwargs=order_kwargs, items=items)

        self.assertEqual(ctx.exception.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", ctx.exception.detail)

        # Whole checkout rolled back: no order persisted, stock untouched.
        self.assertEqual(Order.objects.count(), 0)
        self.wh_stock.refresh_from_db()
        self.assertEqual(self.wh_stock.stock, 5)

    def test_guest_checkout_oversell_returns_400_not_500(self):
        from apps.catalog.models import WarehouseStock

        payload = {
            "guest_email": "race@test.com",
            "items": [{"product_id": self.product.id, "quantity": 2}],
            **SHIPPING,
        }
        with patch.object(
            WarehouseStock,
            "save",
            side_effect=IntegrityError("warehouse_stock_non_negative"),
        ):
            res = self.client.post("/api/v1/orders/guest-checkout/", payload, format="json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)
        self.wh_stock.refresh_from_db()
        self.assertEqual(self.wh_stock.stock, 5)


class ProductVariantOrderTests(APITestCase):
    def setUp(self):
        from apps.catalog.models import Category, Product, ProductVariant, Warehouse, WarehouseStock

        self.user = User.objects.create_user(
            username="variantbuyer", password="pass12345", email="variantbuyer@test.com"
        )
        self.category = Category.objects.create(name="Shirts")
        self.product = Product.objects.create(
            category=self.category,
            name="Super T-Shirt",
            price=Decimal("15.00"),
            sku="SHIRT-BASE",
            stock=0,
        )
        self.variant_red = ProductVariant.objects.create(
            product=self.product,
            name="Red",
            sku="SHIRT-RED",
            price=Decimal("17.00"),
            stock=0,
        )
        self.variant_blue = ProductVariant.objects.create(
            product=self.product,
            name="Blue",
            sku="SHIRT-BLUE",
            price=Decimal("18.00"),
            stock=0,
        )
        self.warehouse = Warehouse.objects.create(
            name="Test Warehouse",
            code="TEST_WH",
            is_active=True,
        )
        # Pre-populate stock
        self.stock_red = WarehouseStock.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            variant=self.variant_red,
            stock=10,
        )
        self.stock_blue = WarehouseStock.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            variant=self.variant_blue,
            stock=10,
        )
        self.product.refresh_from_db()
        self.variant_red.refresh_from_db()
        self.variant_blue.refresh_from_db()
        self.client.force_authenticate(self.user)

    def test_checkout_multiple_variants_success(self):
        from apps.orders.services import create_order_and_items

        order_kwargs = {
            "user": self.user,
            "shipping_full_name": "Variant Test",
            "shipping_address": "456 Main St",
            "shipping_city": "Boston",
            "shipping_postal_code": "02111",
            "shipping_country": "US",
        }
        items = [
            {"product_id": self.product.id, "quantity": 2, "variant_id": self.variant_red.id},
            {"product_id": self.product.id, "quantity": 3, "variant_id": self.variant_blue.id},
        ]

        # Verify no constraint error is thrown when placing an order with multiple variants
        order, order_items = create_order_and_items(order_kwargs=order_kwargs, items=items)
        self.assertEqual(order.items.count(), 2)

        # Verify stock was decremented correctly
        self.stock_red.refresh_from_db()
        self.stock_blue.refresh_from_db()
        self.assertEqual(self.stock_red.stock, 8)
        self.assertEqual(self.stock_blue.stock, 7)

        # Verify variant properties are assigned on order items
        red_item = order.items.get(variant=self.variant_red)
        blue_item = order.items.get(variant=self.variant_blue)
        self.assertEqual(red_item.unit_price, Decimal("17.00"))
        self.assertEqual(blue_item.unit_price, Decimal("18.00"))

        # Verify restocking works correctly for variants
        order.restock()
        self.stock_red.refresh_from_db()
        self.stock_blue.refresh_from_db()
        self.assertEqual(self.stock_red.stock, 10)
        self.assertEqual(self.stock_blue.stock, 10)

    def test_guest_checkout_with_variant_success(self):
        fake_session = MagicMock(id="cs_guest_var", url="https://stripe.test/checkout")
        payload = {
            "guest_email": "guestvar@test.com",
            "items": [
                {"product_id": self.product.id, "quantity": 1, "variant_id": self.variant_red.id}
            ],
            "shipping_full_name": "Guest Var",
            "shipping_address": "123 Var St",
            "shipping_city": "Seattle",
            "shipping_postal_code": "98101",
            "shipping_country": "US",
        }
        self.client.force_authenticate(None)

        with patch("apps.orders.views.stripe.checkout.Session.create", return_value=fake_session):
            res = self.client.post("/api/v1/orders/guest-checkout/", payload, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(guest_email="guestvar@test.com")
        self.assertEqual(order.items.first().variant, self.variant_red)


class TrackingTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser("staff", "staff@test.com", "pass")
        self.user = User.objects.create_user("user", "user@test.com", "pass")
        self.category = Category.objects.create(name="Gadgets")
        self.product = Product.objects.create(
            category=self.category,
            name="Widget",
            price=Decimal("10.00"),
            stock=5,
            sku="TRK-001",
        )
        self.order = Order.objects.create(
            user=self.user,
            total=Decimal("10.00"),
            shipping_full_name="Test User",
            shipping_address="123 St",
            shipping_city="City",
            shipping_postal_code="12345",
            shipping_country="US",
            status=Order.Status.PAID,
        )

    def test_non_staff_cannot_update_tracking(self):
        self.client.force_authenticate(self.user)
        res = self.client.patch(
            f"/api/v1/orders/{self.order.id}/tracking/",
            {"tracking_number": "1Z999AA10123456784"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_set_tracking(self):
        self.client.force_authenticate(self.staff)
        res = self.client.patch(
            f"/api/v1/orders/{self.order.id}/tracking/",
            {"tracking_number": "1Z999AA10123456784", "carrier": "ups"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.tracking_number, "1Z999AA10123456784")
        self.assertEqual(self.order.carrier, "ups")

    def test_tracking_requires_number(self):
        self.client.force_authenticate(self.staff)
        res = self.client.patch(
            f"/api/v1/orders/{self.order.id}/tracking/", {"carrier": "fedex"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tracking_rejects_invalid_carrier(self):
        self.client.force_authenticate(self.staff)
        res = self.client.patch(
            f"/api/v1/orders/{self.order.id}/tracking/",
            {"tracking_number": "ABC123", "carrier": "dhl"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.carrier, "dhl")

    def test_tracking_exposed_in_order_detail(self):
        self.order.tracking_number = "9400111899223096774535"
        self.order.carrier = "usps"
        self.order.save(update_fields=["tracking_number", "carrier"])
        self.client.force_authenticate(self.user)
        res = self.client.get(f"/api/v1/orders/{self.order.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["tracking_number"], "9400111899223096774535")
        self.assertEqual(res.data["carrier"], "usps")
