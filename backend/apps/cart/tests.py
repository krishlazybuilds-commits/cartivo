from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Category, Product

User = get_user_model()


class CartTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="shopper", password="pass12345")
        self.category = Category.objects.create(name="Gadgets")
        self.product = Product.objects.create(
            category=self.category,
            name="Widget",
            price=Decimal("10.00"),
            stock=5,
            sku="WID-1",
        )
        self.client.force_authenticate(self.user)

    def _item(self):
        return Cart.objects.get(user=self.user).items.first()

    def test_add_item_creates_cart_item(self):
        res = self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 2}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._item().quantity, 2)

    def test_adding_same_product_increments_quantity(self):
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 1}, format="json"
        )
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 2}, format="json"
        )
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 1)
        self.assertEqual(self._item().quantity, 3)

    def test_add_over_stock_returns_400(self):
        res = self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 6}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", res.data)

    def test_cumulative_add_over_stock_returns_400(self):
        """Regression: adding to an existing item must check the cumulative total."""
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 3}, format="json"
        )
        res = self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 3}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", res.data)
        # Quantity unchanged at 3.
        self.assertEqual(self._item().quantity, 3)

    def test_patch_update_over_stock_returns_400(self):
        """Regression: quantity-only PATCH must still validate against stock."""
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 1}, format="json"
        )
        item = self._item()
        res = self.client.patch(
            f"/api/cart-items/{item.id}/", {"quantity": 99}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", res.data)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 1)

    def test_patch_valid_update_succeeds(self):
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 1}, format="json"
        )
        item = self._item()
        res = self.client.patch(
            f"/api/cart-items/{item.id}/", {"quantity": 4}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 4)

    def test_remove_item(self):
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 1}, format="json"
        )
        item = self._item()
        res = self.client.delete(f"/api/cart-items/{item.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 0)

    def test_clear_cart(self):
        self.client.post(
            "/api/cart-items/", {"product": self.product.id, "quantity": 1}, format="json"
        )
        res = self.client.post("/api/cart/clear/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Cart.objects.get(user=self.user).items.count(), 0)

    def test_cart_requires_authentication(self):
        self.client.force_authenticate(None)
        res = self.client.get("/api/cart/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
