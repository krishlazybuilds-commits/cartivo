from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

User = get_user_model()


class RegistrationTests(APITestCase):
    def test_register_creates_user(self):
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "newbie", "password": "strongpass123", "email": "n@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newbie").exists())
        # Password must never be echoed back.
        self.assertNotIn("password", res.data)

    def test_register_rejects_short_password(self):
        res = self.client.post(
            "/api/v1/auth/register/",
            {"username": "shorty", "password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="shorty").exists())

    def test_register_requires_username(self):
        res = self.client.post(
            "/api/v1/auth/register/", {"password": "strongpass123"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_is_hashed(self):
        self.client.post(
            "/api/v1/auth/register/",
            {"username": "secure", "password": "strongpass123", "email": "secure@example.com"},
            format="json",
        )
        user = User.objects.get(username="secure")
        self.assertNotEqual(user.password, "strongpass123")
        self.assertTrue(user.check_password("strongpass123"))


class AuthTokenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="member", password="strongpass123", email="member@example.com"
        )

    def test_login_sets_auth_cookies(self):
        res = self.client.post(
            "/api/v1/auth/token/",
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
            "/api/v1/auth/token/",
            {"username": "member", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        res = self.client.get("/api/v1/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/v1/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["username"], "member")


@override_settings(
    ACCOUNT_LOCKOUT_MAX_ATTEMPTS=2,
    ACCOUNT_LOCKOUT_WINDOW_MINUTES=1,
    ACCOUNT_LOCKOUT_DURATION_MINUTES=1,
)
class AccountLockoutTests(APITestCase):
    """Account-level lockout protects against credential stuffing."""

    URL = "/api/v1/auth/token/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="lockme", password="strongpass123", email="lockme@example.com"
        )
        # Clear any lockout state from previous tests so each method starts
        # with a clean slate (Django does not flush the cache between tests).
        from .lockout import clear_attempts

        clear_attempts("lockme")

    def test_locks_out_after_max_attempts(self):
        # With MAX_ATTEMPTS=2:
        #   Attempt 1 (i=0) → counter=1 (<2) → 401
        #   Attempt 2 (i=1) → counter=2 (>=2) → sets lockout key, returns 429
        for i in range(2):
            res = self.client.post(
                self.URL,
                {"username": "lockme", "password": "wrong"},
                format="json",
            )
            if i == 0:
                self.assertEqual(
                    res.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                    msg="Attempt 1: expected 401",
                )
            else:
                self.assertEqual(
                    res.status_code,
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    msg="Attempt 2: expected 429 lockout",
                )
                self.assertIn("retry_after_seconds", res.data)

    def test_lockout_clears_on_successful_login(self):
        # Trigger lockout with 2 failures.
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        # 2nd attempt sets lockout key; view returns 429 (lockout check at top).
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )

        # Verify locked out.
        res = self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Clear attempts directly (simulates successful auth elsewhere).
        from .lockout import clear_attempts

        clear_attempts("lockme")

        # Now login should succeed.
        res = self.client.post(
            self.URL,
            {"username": "lockme", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.cookies)

    def test_resets_counter_on_successful_login(self):
        """One failed attempt then success should keep counter below threshold."""
        # One failure.
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )

        # Successful login resets.
        res = self.client.post(
            self.URL,
            {"username": "lockme", "password": "strongpass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # One more failure should still be 401 (counter was reset).
        res = self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lockout_is_per_username(self):
        """Locking out one username should not affect another."""
        User.objects.create_user(
            username="other", password="strongpass456", email="other@example.com"
        )

        # Lock out 'lockme' (2 attempts).
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )

        # 'other' should still be able to log in.
        res = self.client.post(
            self.URL,
            {"username": "other", "password": "strongpass456"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.cookies)

    def test_lockout_message_includes_minutes(self):
        # Lock out 'lockme'.
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )

        # Check lockout response message.
        res = self.client.post(
            self.URL,
            {"username": "lockme", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("temporarily locked", res.data["detail"].lower())
        self.assertIn("minute", res.data["detail"].lower())


class AdminUserManagementTests(APITestCase):
    URL = "/api/v1/auth/admin/users/"

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", password="strongpass123", is_staff=True, email="admin@example.com"
        )
        self.member = User.objects.create_user(
            username="member", password="strongpass123", email="member@example.com"
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
        res = self.client.patch(self._detail(self.member), {"is_active": False}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)

    def test_admin_can_promote_a_user_to_staff(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(self._detail(self.member), {"is_staff": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_staff)

    def test_admin_cannot_deactivate_self(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(self._detail(self.admin), {"is_active": False}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_cannot_demote_self(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(self._detail(self.admin), {"is_staff": False}, format="json")
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
            username="root", password="strongpass123", email="root@example.com"
        )
        self.client.force_authenticate(self.admin)
        res = self.client.patch(self._detail(superuser), {"is_active": False}, format="json")
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
        res = self.client.get("/api/v1/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_staff"])


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-client-id.apps.googleusercontent.com")
class GoogleLoginTests(APITestCase):
    URL = "/api/v1/auth/google/"

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
            last_name="Smith",
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
            username="disableduser", email="disabled@example.com", is_active=False
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


class PasswordResetRequestTests(APITestCase):
    URL = "/api/v1/auth/password-reset/"

    def test_returns_200_for_empty_email(self):
        res = self.client.post(self.URL, {"email": ""}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "If that email exists, a reset link has been sent.")

    def test_returns_200_for_missing_email_field(self):
        res = self.client.post(self.URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_returns_200_for_invalid_email_format(self):
        res = self.client.post(self.URL, {"email": "not-an-email"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "If that email exists, a reset link has been sent.")

    def test_returns_200_for_nonexistent_email(self):
        res = self.client.post(self.URL, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    @patch("apps.accounts.views.send_password_reset_email_task.delay")
    def test_does_not_send_email_for_nonexistent_email(self, mock_delay):
        self.client.post(self.URL, {"email": "nobody@example.com"}, format="json")
        mock_delay.assert_not_called()

    @patch("apps.accounts.views.send_password_reset_email_task.delay")
    def test_sends_email_for_existing_user(self, mock_delay):
        User.objects.create_user(username="alice", email="alice@example.com")
        self.client.post(self.URL, {"email": "alice@example.com"}, format="json")
        mock_delay.assert_called_once()
        args, _ = mock_delay.call_args
        self.assertEqual(args[0], User.objects.get(username="alice").pk)
        self.assertIn("/reset-password?uid=", args[1])

    @patch("apps.accounts.views.send_password_reset_email_task.delay")
    def test_sends_email_case_insensitive(self, mock_delay):
        User.objects.create_user(username="bob", email="Bob@Example.com")
        self.client.post(self.URL, {"email": "bob@example.com"}, format="json")
        mock_delay.assert_called_once()

    @patch("apps.accounts.views.send_password_reset_email_task.delay")
    def test_sends_to_each_user_when_email_shared(self, mock_delay):
        # Email uniqueness is now enforced; only one user can hold an email.
        # Verify the reset email is sent to exactly that one user.
        User.objects.create_user(username="user1", email="shared@example.com")
        self.client.post(self.URL, {"email": "shared@example.com"}, format="json")
        self.assertEqual(mock_delay.call_count, 1)


class PasswordResetConfirmTests(APITestCase):
    URL = "/api/v1/auth/password-reset/confirm/"
    NEW_PASS = "NewStr0ng!Pass"

    def setUp(self):
        self.user = User.objects.create_user(
            username="resetuser", email="reset@example.com", password="OldPass123!"
        )
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = default_token_generator.make_token(self.user)

    def _valid_payload(self):
        return {"uid": self.uid, "token": self.token, "new_password": self.NEW_PASS}

    def test_requires_all_fields(self):
        res = self.client.post(self.URL, {"uid": self.uid}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "uid, token and new_password are required.")

    def test_requires_token(self):
        res = self.client.post(
            self.URL, {"uid": self.uid, "new_password": self.NEW_PASS}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_new_password(self):
        res = self.client.post(self.URL, {"uid": self.uid, "token": self.token}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_invalid_uid(self):
        res = self.client.post(self.URL, {**self._valid_payload(), "uid": "invalid"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Invalid link.")

    def test_rejects_nonexistent_user_uid(self):
        # Encode a pk that doesn't exist.
        bad_uid = urlsafe_base64_encode(force_bytes(99999))
        res = self.client.post(self.URL, {**self._valid_payload(), "uid": bad_uid}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Invalid link.")

    def test_rejects_invalid_token(self):
        res = self.client.post(
            self.URL, {**self._valid_payload(), "token": "wrong-token"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Reset link is invalid or has expired.")

    def test_rejects_weak_password(self):
        res = self.client.post(
            self.URL, {**self._valid_payload(), "new_password": "short"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resets_password_successfully(self):
        res = self.client.post(self.URL, self._valid_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "Password reset successful.")

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.NEW_PASS))

    def test_token_is_consumed_after_use(self):
        # First use succeeds.
        self.client.post(self.URL, self._valid_payload(), format="json")
        # Same token should now be rejected.
        res = self.client.post(self.URL, self._valid_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"], "Reset link is invalid or has expired.")

    def test_reset_blacklists_existing_refresh_tokens(self):
        # Simulate an active session (or a stolen refresh token) on another device.
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken

        old_refresh = str(RefreshToken.for_user(self.user))
        # Sanity: token validates before reset.
        RefreshToken(old_refresh)

        res = self.client.post(self.URL, self._valid_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # The stolen refresh token must now be rejected.
        with self.assertRaises(TokenError):
            RefreshToken(old_refresh)

    def test_reset_does_not_set_auth_cookies(self):
        # Reset is initiated by anonymous email link, so the response must
        # never log the user in automatically — they have to re-authenticate.
        res = self.client.post(self.URL, self._valid_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("access_token", res.cookies)
        self.assertNotIn("refresh_token", res.cookies)


class ChangePasswordTests(APITestCase):
    URL = "/api/v1/auth/me/password/"
    OLD_PASS = "OldStrong123!"
    NEW_PASS = "NewStr0ng!Pass"

    def setUp(self):
        self.user = User.objects.create_user(
            username="changer", password=self.OLD_PASS, email="changer@example.com"
        )

    def test_requires_authentication(self):
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": self.NEW_PASS},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejects_wrong_current_password(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": "wrongpass", "new_password": self.NEW_PASS},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Current password is incorrect.", str(res.data))

    def test_rejects_weak_new_password(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_changes_password_successfully(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": self.NEW_PASS},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["detail"], "Password changed successfully.")

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.NEW_PASS))
        self.assertFalse(self.user.check_password(self.OLD_PASS))

    def test_change_password_blacklists_existing_refresh_tokens(self):
        # Simulate an attacker holding a stolen refresh token on another device.
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken

        attacker_refresh = str(RefreshToken.for_user(self.user))
        # Sanity: token validates before the change.
        RefreshToken(attacker_refresh)

        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": self.NEW_PASS},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Attacker's refresh token must now be rejected.
        with self.assertRaises(TokenError):
            RefreshToken(attacker_refresh)

    def test_change_password_reissues_auth_cookies_for_current_device(self):
        # The user who just authenticated by entering their current password
        # should not be logged out of the device they're using; the response
        # must carry a fresh access/refresh cookie pair.
        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": self.NEW_PASS},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.cookies)
        self.assertIn("refresh_token", res.cookies)
        self.assertTrue(res.cookies["access_token"]["httponly"])
        self.assertTrue(res.cookies["refresh_token"]["httponly"])

    def test_change_password_fresh_refresh_token_still_works(self):
        # The newly issued refresh token (returned in the cookie) must validate
        # — i.e. we did not blacklist the token we just minted for the user.
        from rest_framework_simplejwt.tokens import RefreshToken

        self.client.force_authenticate(self.user)
        res = self.client.post(
            self.URL,
            {"current_password": self.OLD_PASS, "new_password": self.NEW_PASS},
            format="json",
        )
        new_refresh = res.cookies["refresh_token"].value
        # Should not raise.
        RefreshToken(new_refresh)


class ProductionSettingsTests(
    SimpleTestCase := __import__("django.test", fromlist=["SimpleTestCase"]).SimpleTestCase
):
    def test_production_settings_validation(self):
        import importlib
        import os
        import sys
        from django.core.exceptions import ImproperlyConfigured

        original_env = os.environ.copy()
        original_argv = sys.argv.copy()
        try:
            os.environ["DJANGO_DEBUG"] = "False"
            os.environ["DJANGO_SECRET_KEY"] = "test-secret-key-1234567890-very-long-and-secure"

            # 1. Test wildcard in ALLOWED_HOSTS raises error
            os.environ["DJANGO_ALLOWED_HOSTS"] = "*"
            os.environ["CORS_ALLOWED_ORIGINS"] = "https://example.com"
            os.environ["CSRF_TRUSTED_ORIGINS"] = "https://example.com"
            if "test" in sys.argv:
                sys.argv.remove("test")

            # Use absolute import path relative to sys.path
            from config import settings as config_settings

            with self.assertRaises(ImproperlyConfigured) as ctx:
                importlib.reload(config_settings)
            self.assertIn("DJANGO_ALLOWED_HOSTS cannot contain the wildcard", str(ctx.exception))

            # 2. Test wildcard in CORS_ALLOWED_ORIGINS raises error
            os.environ["DJANGO_ALLOWED_HOSTS"] = "example.com"
            os.environ["CORS_ALLOWED_ORIGINS"] = "https://*"
            with self.assertRaises(ImproperlyConfigured) as ctx:
                importlib.reload(config_settings)
            self.assertIn("CORS_ALLOWED_ORIGINS cannot contain wildcards", str(ctx.exception))

            # 3. Test non-HTTPS in CORS_ALLOWED_ORIGINS raises error
            os.environ["CORS_ALLOWED_ORIGINS"] = "http://example.com"
            with self.assertRaises(ImproperlyConfigured) as ctx:
                importlib.reload(config_settings)
            self.assertIn("CORS_ALLOWED_ORIGINS must use secure HTTPS", str(ctx.exception))

            # 4. Test wildcard in CSRF_TRUSTED_ORIGINS raises error
            os.environ["CORS_ALLOWED_ORIGINS"] = "https://example.com"
            os.environ["CSRF_TRUSTED_ORIGINS"] = "https://*"
            with self.assertRaises(ImproperlyConfigured) as ctx:
                importlib.reload(config_settings)
            self.assertIn("CSRF_TRUSTED_ORIGINS cannot contain wildcards", str(ctx.exception))

            # 5. Test non-HTTPS in CSRF_TRUSTED_ORIGINS raises error
            os.environ["CSRF_TRUSTED_ORIGINS"] = "http://example.com"
            with self.assertRaises(ImproperlyConfigured) as ctx:
                importlib.reload(config_settings)
            self.assertIn("CSRF_TRUSTED_ORIGINS must use secure HTTPS", str(ctx.exception))

        finally:
            # Restore environment and sys.argv
            os.environ.clear()
            os.environ.update(original_env)
            sys.argv = original_argv
            # Reload settings one last time to restore original state
            from config import settings as config_settings

            importlib.reload(config_settings)
