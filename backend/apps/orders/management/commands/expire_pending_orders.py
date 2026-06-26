"""
Expire (cancel + restock) unpaid PENDING orders older than a cutoff.

PENDING orders reserve stock the moment they're created at checkout. If the
customer never completes payment, that stock would otherwise be held forever.
This command releases it by cancelling stale pending orders and returning their
items to inventory.

Run it on a schedule (cron / Task Scheduler / Celery beat), e.g. every 5 min:
    python manage.py expire_pending_orders
    python manage.py expire_pending_orders --minutes 60
    python manage.py expire_pending_orders --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order

DEFAULT_TIMEOUT_MINUTES = 30


class Command(BaseCommand):
    help = "Cancel and restock unpaid PENDING orders older than the timeout."

    def add_arguments(self, parser):
        parser.add_argument(
            "--minutes",
            type=int,
            default=DEFAULT_TIMEOUT_MINUTES,
            help=(
                f"Age in minutes after which a pending order expires "
                f"(default {DEFAULT_TIMEOUT_MINUTES})."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List orders that would be expired without changing anything.",
        )

    def handle(self, *args, **options):
        minutes = options["minutes"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timezone.timedelta(minutes=minutes)

        stale_ids = list(
            Order.objects.filter(status=Order.Status.PENDING, created_at__lt=cutoff).values_list(
                "id", flat=True
            )
        )

        if not stale_ids:
            self.stdout.write("No pending orders to expire.")
            return

        if dry_run:
            self.stdout.write(
                f"[dry-run] {len(stale_ids)} pending order(s) older than "
                f"{minutes} min would be cancelled: {stale_ids}"
            )
            return

        expired = 0
        for order_id in stale_ids:
            if self._expire_one(order_id):
                expired += 1

        self.stdout.write(self.style.SUCCESS(f"Expired and restocked {expired} pending order(s)."))

    def _expire_one(self, order_id) -> bool:
        """Cancel + restock a single order under a row lock. Returns True if changed."""
        with transaction.atomic():
            # Lock the row and re-check status so we don't race a payment
            # webhook or a manual cancel (mirrors the cancel endpoint).
            order = (
                Order.objects.select_for_update()
                .filter(pk=order_id, status=Order.Status.PENDING)
                .first()
            )
            if order is None:
                return False

            order.restock()
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status"])
            return True
