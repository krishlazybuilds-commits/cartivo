from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Category, Product
from apps.orders.models import Order

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
        self.client.force_authenticate(None)
        res = self.client.post("/api/orders/", SHIPPING, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_users_only_see_their_own_orders(self):
        self._add_to_cart(1)
        self.client.post("/api/orders/", SHIPPING, format="json")

        other = User.objects.create_user(username="other", password="pass12345")
        self.client.force_authenticate(other)
        res = self.client.get("/api/orders/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 0)
