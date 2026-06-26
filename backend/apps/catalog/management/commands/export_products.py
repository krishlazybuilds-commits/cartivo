"""
Export the product catalog to CSV or Excel.

Usage:
    python manage.py export_products                           # stdout as CSV
    python manage.py export_products --format=xlsx             # stdout as Excel
    python manage.py export_products --output=products.csv     # write to file
    python manage.py export_products --format=xlsx -o products.xlsx
"""

import csv
import io
import sys

from django.core.management.base import BaseCommand

from apps.catalog.models import Product

FIELDS = [
    "id",
    "name",
    "slug",
    "sku",
    "category_name",
    "price",
    "sale_price",
    "stock",
    "description",
    "is_active",
    "is_featured",
    "is_new",
    "on_sale",
    "badge",
]


class Command(BaseCommand):
    help = "Export the product catalog to CSV or Excel."

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            "-f",
            default="csv",
            choices=["csv", "xlsx"],
            help="Output format (default: csv).",
        )
        parser.add_argument(
            "--output",
            "-o",
            default=None,
            help="Write to file instead of stdout.",
        )

    def handle(self, *args, **options):
        fmt = options["format"]
        output = options["output"]

        qs = Product.objects.select_related("category").values(*FIELDS)

        if fmt == "xlsx":
            from openpyxl import Workbook

            wb = Workbook()
            ws = wb.active
            ws.title = "Products"
            ws.append(FIELDS)
            for row in qs:
                ws.append([str(row[f]) if row[f] is not None else "" for f in FIELDS])

            if output:
                wb.save(output)
                self.stdout.write(self.style.SUCCESS(f"Exported {qs.count()} products to {output}"))
            else:
                buf = io.BytesIO()
                wb.save(buf)
                buf.seek(0)
                sys.stdout.buffer.write(buf.read())
        else:
            fout = open(output, "w", newline="") if output else None
            try:
                writer = csv.DictWriter(fout or self.stdout, fieldnames=FIELDS)
                writer.writeheader()
                for row in qs:
                    row_out = {k: str(v) if v is not None else "" for k, v in row.items()}
                    if fout:
                        writer.writerow(row_out)
                    else:
                        writer.writerow(row_out)
            finally:
                if fout:
                    fout.close()

            if output:
                self.stdout.write(self.style.SUCCESS(f"Exported {qs.count()} products to {output}"))
