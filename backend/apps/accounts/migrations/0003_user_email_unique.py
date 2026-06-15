"""
Migration: make User.email unique.

Step 1 (RunPython): resolve duplicate emails so the unique constraint can be
applied without data loss.
  - For each group of duplicate (case-insensitive) emails, the earliest
    date_joined record keeps its email; every later duplicate gets its email
    suffixed with  _dup{pk}  so it's easy to find and fix by an admin.
  - Blank-email users: only one can keep email=""; the rest are set to
    blank_{pk}@cartivo.invalid.

Step 2 (AlterField): add unique=True and blank=False on User.email.
"""

from django.db import migrations, models


def deduplicate_emails(apps, schema_editor):
    User = apps.get_model("accounts", "User")

    # ── 1. Handle blank emails ────────────────────────────────────────────────
    blank_users = list(
        User.objects.filter(email="").order_by("date_joined", "pk")
    )
    # Keep the first one with email=""; rename the rest.
    for user in blank_users[1:]:
        user.email = f"blank_{user.pk}@cartivo.invalid"
        user.save(update_fields=["email"])

    # ── 2. Handle non-blank duplicate emails ─────────────────────────────────
    # Collect all non-blank emails that appear more than once (case-insensitive).
    # We do this in Python to stay DB-agnostic (SQLite vs Postgres).
    seen = {}  # normalised_email -> canonical pk (earliest date_joined)
    for user in User.objects.exclude(email="").order_by("date_joined", "pk"):
        key = user.email.lower()
        if key not in seen:
            seen[key] = user.pk  # first occurrence — keep as-is
        else:
            # Later duplicate — suffix with _dup{pk}
            user.email = f"{user.email}_dup{user.pk}"
            user.save(update_fields=["email"])


def noop(apps, schema_editor):
    """Reverse is a no-op — we don't restore the original duplicate emails."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_address"),
    ]

    operations = [
        # Step 1: clean up duplicates before adding the constraint
        migrations.RunPython(deduplicate_emails, reverse_code=noop),

        # Step 2: add the unique constraint + remove blank=True
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                verbose_name="email address",
                blank=False,
                unique=True,
            ),
        ),
    ]
