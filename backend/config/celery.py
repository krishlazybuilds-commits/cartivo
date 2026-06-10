"""Celery application for Cartivo background tasks.

Tasks (order/payment emails, webhook side-effects) run on the same Redis used
for caching/throttling. Configuration is read from Django settings under the
``CELERY_`` namespace. When no broker is configured (local dev/tests without
Redis), tasks run eagerly so the app still works without a worker.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("cartivo")

# Pull all CELERY_* settings from Django settings.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover tasks.py modules in every installed app.
app.autodiscover_tasks()
