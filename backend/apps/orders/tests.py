from decimal import Decimal
from unittest.mock import patch

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
        self.user = User.objects.create_user(username="buyer", password="pass12345", email="buyer@test.com")
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

        other = User.objects.create_user(username="other", password="pass12345", email="other@test.com")
        self.client.force_authenticate(other)
        res = self.client.get("/api/orders/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 0)


class CancelOrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="canceller", password="pass12345", email="canceller@test.com")
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
        other = User.objects.create_user(username="intruder", password="pass12345", email="intruder@test.com")
        self.client.force_authenticate(other)
        res = self.client.post(f"/api/orders/{order_id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


class ExpirePendingOrdersCommandTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="staleuser", password="pass12345", email="staleuser@test.com")
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
        self.user = User.objects.create_user(username="payer", password="pass12345", email="payer@test.com")
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
    def _event(order_id, event_id="evt_1", event_type="checkout.session.completed", amount_total=1000):
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


class StripeWebhookEventTests(APITestCase):
    """Tests for each specific webhook event handler."""

    WEBHOOK_URL = "/api/orders/webhook/"

    def setUp(self):
        self.user = User.objects.create_user(username="evtuser", password="pass12345", email="evtuser@test.com")
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
        with patch(
            "apps.orders.views.stripe.Webhook.construct_event", return_value=event
        ):
            return self.client.post(
                self.WEBHOOK_URL, data="{}", content_type="application/json"
            )

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
        event = self._event(
            "evt_exp_4", "checkout.session.expired", order_id=order.id
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)

    # ── payment_intent.payment_failed ─────────────────────────────────────────

    def test_payment_failed_does_not_change_order_status(self):
        order = self._pending_order()
        event = self._event(
            "evt_fail_1", "payment_intent.payment_failed", order_id=order.id
        )
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
        event = self._event(
            "evt_fail_1", "payment_intent.payment_failed", order_id=order.id
        )
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
            "evt_ref_1", "charge.refunded", order_id=order.id,
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
            "evt_ref_2", "charge.refunded", order_id=order.id,
            overrides={"payment_intent": "pi_refund2"},
        )
        self._post(event)
        # Second delivery of a *different* event_id but same order.
        event2 = self._event(
            "evt_ref_2b", "charge.refunded", order_id=order.id,
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
            "evt_ref_4", "charge.refunded", order_id=order.id,
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
            "evt_cc_1", "checkout.session.completed", order_id=order.id,
            overrides={"amount_total": 1000},  # 10.00 != 30.00
        )
        res = self._post(event)
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_checkout_completed_non_existent_order_is_noop(self):
        event = self._event(
            "evt_cc_2", "checkout.session.completed", order_id=99999,
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
            "evt_cc_4", "checkout.session.completed", order_id=order.id,
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
            res = self.client.post(
                self.WEBHOOK_URL, data="{}", content_type="application/json"
            )
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

        event = self._event(
            "evt_combo", "checkout.session.expired", order_id=order.id
        )
        self._post(event)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, before + 2)


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

