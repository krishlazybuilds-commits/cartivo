from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0010_seed_default_warehouse_stock"),
    ]

    operations = [
        TrigramExtension(),
    ]
