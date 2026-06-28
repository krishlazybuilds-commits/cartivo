"""Preview email templates in your browser without sending them.

Usage:
    python manage.py preview_email              # preview the newsletter welcome email
    python manage.py preview_email --template order_confirmation  # preview another template
"""

import datetime
import os
import webbrowser

from django.core.management.base import BaseCommand
from django.template.loader import render_to_string

TEMPLATES = {
    "newsletter_welcome": {
        "template": "emails/newsletter_welcome.html",
        "context": {
            "site_url": "http://localhost:3000",
            "unsubscribe_url": "http://localhost:3000/api/v1/newsletter/unsubscribe/demo-token/",
        },
    },
    "order_confirmation": {
        "template": "emails/order_confirmation.html",
        "context": {
            "order_number": "ORD-2026-0001",
            "items": [{"name": "Demo Product", "qty": 1, "price": "$99.00"}],
            "total": "$99.00",
            "shipping": "$5.00",
            "tax": "$8.00",
            "grand_total": "$112.00",
            "site_url": "http://localhost:3000",
        },
    },
    "abandoned_cart": {
        "template": "emails/abandoned_cart.html",
        "context": {
            "site_url": "http://localhost:3000",
            "cart_url": "http://localhost:3000/cart",
        },
    },
    "password_reset": {
        "template": "emails/password_reset.html",
        "context": {
            "site_url": "http://localhost:3000",
            "reset_url": "http://localhost:3000/reset-password?token=demo-token",
        },
    },
}


class Command(BaseCommand):
    help = "Render an email template to a file and open it in the browser."

    def add_arguments(self, parser):
        parser.add_argument(
            "--template",
            "-t",
            default="newsletter_welcome",
            choices=list(TEMPLATES.keys()),
            help="Which email template to preview",
        )

    def handle(self, *args, **options):
        key = options["template"]
        cfg = TEMPLATES[key]

        ctx = cfg["context"]
        if "year" not in ctx:
            ctx["year"] = datetime.date.today().year

        html = render_to_string(cfg["template"], ctx)

        out_dir = os.path.join(os.getcwd(), "sent_emails")
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"preview_{key}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

        self.stdout.write(self.style.SUCCESS(f"Preview saved to {path}"))
        webbrowser.open(f"file:///{path.replace(os.sep, '/')}")
