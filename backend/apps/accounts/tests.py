from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegistrationTests(APITestCase):
    def test_register_creates_user(self):
        res = self.client.post(
            "/api/auth/register/",
            {"username": "newbie", "password": "strongpass123", "email": "n@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newbie").exists())
        # Password must never be echoed back.
        self.assertNotIn("password", res.data)

    def test_register_rejects_short_password(self):
        res = self.client.post(
            "/api/auth/register/",
            {"username": "shorty", "password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="shorty").exists())

    def test_register_requires_username(self):
        res = self.client.post(
            "/api/auth/register/", {"password": "strongpass123"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_is_hashed(self):
        self.client.post(
            "/api/auth/register/",
            {"username": "secure", "password": "strongpass123"},
            format="json",
        )
        user = User.objects.get(username="secure")
        self.assertNotEqual(user.password, "strongpass123")
        self.assertTrue(user.check_password("strongpass123"))


class AuthTokenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="member", password="strongpass123")

    def test_login_sets_auth_cookies(self):
        res = self.client.post(
            "/api/auth/token/",
            {"username": "member", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Tokens are delivered as httpOnly cookies, not in the response body.
        self.assertIn("access_token", res.cookies)
        self.assertIn("refresh_token", res.cookies)
        self.assertNotIn("access", res.data)
        self.assertTrue(res.cookies["access_token"]["httponly"])

    def test_login_with_wrong_password_fails(self):
        res = self.client.post(
            "/api/auth/token/",
            {"username": "member", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["username"], "member")
