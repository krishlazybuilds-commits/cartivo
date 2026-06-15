from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

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


class AdminUserManagementTests(APITestCase):
    URL = "/api/auth/admin/users/"

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="strongpass123", is_staff=True
        )
        self.member = User.objects.create_user(
            username="member", password="strongpass123"
        )

    def _detail(self, user):
        return f"{self.URL}{user.pk}/"

    def test_non_admin_cannot_list_users(self):
        self.client.force_authenticate(self.member)
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_list_users(self):
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_list_users(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 2)

    def test_admin_can_deactivate_a_user(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._detail(self.member), {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)

    def test_admin_can_promote_a_user_to_staff(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._detail(self.member), {"is_staff": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_staff)

    def test_admin_cannot_deactivate_self(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._detail(self.admin), {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_cannot_demote_self(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._detail(self.admin), {"is_staff": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff)

    def test_admin_cannot_delete_self(self):
        self.client.force_authenticate(self.admin)
        res = self.client.delete(self._detail(self.admin))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_admin_can_delete_other_user(self):
        self.client.force_authenticate(self.admin)
        res = self.client.delete(self._detail(self.member))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.member.pk).exists())

    def test_non_superuser_admin_cannot_modify_superuser(self):
        superuser = User.objects.create_superuser(
            username="root", password="strongpass123"
        )
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            self._detail(superuser), {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        superuser.refresh_from_db()
        self.assertTrue(superuser.is_active)

    def test_admin_can_search_users(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(self.URL, {"search": "member"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data["results"] if "results" in res.data else res.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["username"], "member")

    def test_me_exposes_staff_flag(self):
         self.client.force_authenticate(self.admin)
         res = self.client.get("/api/auth/me/")
         self.assertEqual(res.status_code, status.HTTP_200_OK)
         self.assertTrue(res.data["is_staff"])


class GoogleLoginTests(APITestCase):
    URL = "/api/auth/google/"

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_not_configured(self, mock_verify):
        from django.test import override_settings
        with override_settings(GOOGLE_OAUTH_CLIENT_ID=""):
            res = self.client.post(self.URL, {"credential": "some_token"}, format="json")
            self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(res.data["detail"], "Google sign-in is not configured.")

    def test_google_login_missing_credential(self):
        res = self.client.post(self.URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Missing Google credential.")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_invalid_credential(self, mock_verify):
        mock_verify.side_effect = ValueError("Invalid token")
        res = self.client.post(self.URL, {"credential": "invalid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["detail"], "Invalid Google credential.")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_unverified_email(self, mock_verify):
        mock_verify.return_value = {
            "email": "unverified@example.com",
            "email_verified": False,
            "given_name": "Unverified",
            "family_name": "User",
        }
        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["detail"], "Google account email is missing or unverified.")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_missing_email(self, mock_verify):
        mock_verify.return_value = {
            "email_verified": True,
            "given_name": "NoEmail",
            "family_name": "User",
        }
        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["detail"], "Google account email is missing or unverified.")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_new_user_creation(self, mock_verify):
        mock_verify.return_value = {
            "email": "newgoogleuser@example.com",
            "email_verified": True,
            "given_name": "John",
            "family_name": "Doe",
        }
        self.assertFalse(User.objects.filter(email="newgoogleuser@example.com").exists())

        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "Login successful.")

        self.assertIn("access_token", res.cookies)
        self.assertIn("refresh_token", res.cookies)

        user = User.objects.get(email="newgoogleuser@example.com")
        self.assertEqual(user.first_name, "John")
        self.assertEqual(user.last_name, "Doe")
        self.assertEqual(user.username, "newgoogleuser")
        self.assertTrue(user.is_active)
        self.assertFalse(user.has_usable_password())

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_existing_user(self, mock_verify):
        existing_user = User.objects.create_user(
            username="existinguser",
            email="existinggoogle@example.com",
            first_name="Jane",
            last_name="Smith"
        )
        mock_verify.return_value = {
            "email": "existinggoogle@example.com",
            "email_verified": True,
            "given_name": "Jane",
            "family_name": "Smith",
        }

        initial_count = User.objects.count()

        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "Login successful.")

        self.assertIn("access_token", res.cookies)
        self.assertIn("refresh_token", res.cookies)

        self.assertEqual(User.objects.count(), initial_count)

        user = User.objects.get(email="existinggoogle@example.com")
        self.assertEqual(user.pk, existing_user.pk)

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_disabled_user(self, mock_verify):
        User.objects.create_user(
            username="disableduser",
            email="disabled@example.com",
            is_active=False
        )
        mock_verify.return_value = {
            "email": "disabled@example.com",
            "email_verified": True,
            "given_name": "Disabled",
            "family_name": "User",
        }

        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data["detail"], "This account is disabled.")

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_username_collision(self, mock_verify):
        User.objects.create_user(username="conflict", email="other@example.com")

        mock_verify.return_value = {
            "email": "conflict@example.com",
            "email_verified": True,
            "given_name": "Conflict",
            "family_name": "User",
        }

        res = self.client.post(self.URL, {"credential": "valid_token"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="conflict@example.com")
        self.assertEqual(user.username, "conflict1")
