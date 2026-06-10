from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"

    def ready(self):
        # Register drf-spectacular extension for cookie JWT auth.
        import apps.accounts.openapi  # noqa: F401
