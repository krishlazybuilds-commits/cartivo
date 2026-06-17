from django.core import mail
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ContactEndpointTests(APITestCase):
    URL = "/api/v1/contact/"
    VALID = {
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "message": "Hello, I have a question about your products.",
    }

    def test_valid_submission_sends_email(self):
        res = self.client.post(self.URL, self.VALID, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Grace Hopper", mail.outbox[0].subject)

    def test_missing_fields_returns_400(self):
        res = self.client.post(self.URL, {"name": "Only Name"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_email_returns_400(self):
        payload = {**self.VALID, "email": "not-an-email"}
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)

    def test_overlong_message_returns_400(self):
        payload = {**self.VALID, "message": "x" * 5001}
        res = self.client.post(self.URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 0)
