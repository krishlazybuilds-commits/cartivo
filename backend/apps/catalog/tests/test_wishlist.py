from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product, WishlistItem

User = get_user_model()


class WishlistTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="wisher", password="strongpass123"
        )
        self.other = User.objects.create_user(
            username="other", password="strongpass123"
        )
        self.cat = Category.objects.create(name="Test Category")
        self.prod = Product.objects.create(
            category=self.cat,
            name="Widget",
            slug="widget",
            price=19.99,
            stock=5,
            sku="WGT-001",
        )
        self.prod2 = Product.objects.create(
            category=self.cat,
            name="Gadget",
            slug="gadget",
            price=29.99,
            stock=3,
            sku="GGT-001",
        )
        self.list_url = "/api/wishlist/"

    # --- Auth guard ----------------------------------------------------------

    def test_unauthenticated_list_returns_401(self):
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_add_returns_401(self):
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_delete_returns_401(self):
        res = self.client.delete(f"{self.list_url}1/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- Create (POST) -------------------------------------------------------

    def test_add_item_to_wishlist(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WishlistItem.objects.count(), 1)
        self.assertEqual(
            WishlistItem.objects.first().user, self.user
        )

    def test_add_item_returns_product_fields(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("product_name", res.data)
        self.assertEqual(res.data["product_name"], "Widget")
        self.assertIn("product_price", res.data)
        self.assertIn("product_slug", res.data)

    def test_duplicate_item_returns_400(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(self.list_url, {"product": self.prod.id}, format="json")
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_nonexistent_product_returns_400(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            self.list_url, {"product": 99999}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # --- List (GET) ----------------------------------------------------------

    def test_list_returns_users_items(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(self.list_url, {"product": self.prod.id}, format="json")
        self.client.post(self.list_url, {"product": self.prod2.id}, format="json")
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)
        product_names = {r["product_name"] for r in results}
        self.assertIn("Widget", product_names)
        self.assertIn("Gadget", product_names)

    def test_list_isolation_between_users(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(self.list_url, {"product": self.prod.id}, format="json")
        self.client.force_authenticate(user=self.other)
        res = self.client.get(self.list_url)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 0)

    # --- Delete (DELETE) -----------------------------------------------------

    def test_remove_item_from_wishlist(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        item_id = res.data["id"]
        res = self.client.delete(f"{self.list_url}{item_id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(WishlistItem.objects.count(), 0)

    def test_remove_others_item_returns_404(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(
            self.list_url, {"product": self.prod.id}, format="json"
        )
        item_id = res.data["id"]
        self.client.force_authenticate(user=self.other)
        res = self.client.delete(f"{self.list_url}{item_id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
