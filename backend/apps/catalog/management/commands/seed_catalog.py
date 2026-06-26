"""
Seed the catalog with the curated demo categories and products.

Idempotent: safe to run repeatedly. Categories are matched by `slug` and
products by `sku`, so re-running updates existing rows instead of creating
duplicates. Image paths point at files already tracked in
`media/products/<SKU>.png`.

Usage:
    python manage.py seed_catalog
    python manage.py seed_catalog --flush   # delete existing catalog first
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Category, Product


# (slug, name, description)
CATEGORIES = [
    ("laptops", "Laptops", "Portable computers for work, study, and play."),
    ("audio", "Audio", "Headphones, earbuds, and speakers."),
    ("smartphones", "Smartphones", "The latest flagship mobile phones."),
    ("wearables", "Wearables", "Smartwatches and fitness wearables."),
    ("tv-streaming", "TV & Streaming", "Smart TVs and streaming media devices."),
    ("accessories", "Accessories", "Peripherals and add-ons for your devices."),
]

# (sku, category_slug, name, slug, description, price, stock)
# The image is derived as products/<sku>.png to match the tracked files.
PRODUCTS = [
    (
        "LAP-MBA13-M4",
        "laptops",
        'Apple MacBook Air 13" (M4)',
        "apple-macbook-air-13-m4",
        "Ultraportable laptop powered by the Apple M4 chip with a 13.6-inch "
        "Liquid Retina display and all-day battery life.",
        "999.00",
        25,
    ),
    (
        "LAP-XPS13",
        "laptops",
        "Dell XPS 13",
        "dell-xps-13",
        "Premium 13-inch Windows ultrabook with an InfinityEdge display and "
        "machined aluminum chassis.",
        "999.00",
        18,
    ),
    (
        "AUD-APP3",
        "audio",
        "Apple AirPods Pro 3",
        "apple-airpods-pro-3",
        "Wireless earbuds with active noise cancellation, adaptive audio, and "
        "a USB-C charging case.",
        "249.00",
        80,
    ),
    (
        "AUD-WH1000XM5",
        "audio",
        "Sony WH-1000XM5",
        "sony-wh-1000xm5",
        "Over-ear wireless headphones with industry-leading noise cancellation "
        "and up to 30 hours of battery life.",
        "399.00",
        40,
    ),
    (
        "AUD-JBLFLIP6",
        "audio",
        "JBL Flip 6",
        "jbl-flip-6",
        "Portable IP67 waterproof Bluetooth speaker with bold JBL Original Pro " "sound.",
        "129.00",
        60,
    ),
    (
        "PHN-IP16",
        "smartphones",
        "Apple iPhone 16",
        "apple-iphone-16",
        "6.1-inch smartphone with the A18 chip, advanced camera system, and the " "Action button.",
        "799.00",
        50,
    ),
    (
        "PHN-GALS25",
        "smartphones",
        "Samsung Galaxy S25",
        "samsung-galaxy-s25",
        "Flagship Android phone with a Snapdragon processor, AI features, and a "
        "vivid Dynamic AMOLED display.",
        "799.00",
        45,
    ),
    (
        "WER-AWS10",
        "wearables",
        "Apple Watch Series 10",
        "apple-watch-series-10",
        "Smartwatch with a larger always-on display, advanced health sensors, "
        "and fast charging.",
        "399.00",
        35,
    ),
    (
        "WER-GALW7",
        "wearables",
        "Samsung Galaxy Watch 7",
        "samsung-galaxy-watch-7",
        "Android smartwatch with comprehensive health tracking and a bright "
        "Super AMOLED display.",
        "299.00",
        30,
    ),
    (
        "TVS-FTV4KP",
        "tv-streaming",
        "Amazon Fire TV Stick 4K Plus",
        "amazon-fire-tv-stick-4k-plus",
        "4K streaming media player with Wi-Fi 6E support and an Alexa Voice " "Remote.",
        "59.00",
        120,
    ),
    (
        "TVS-ECHODOT",
        "tv-streaming",
        "Amazon Echo Dot",
        "amazon-echo-dot",
        "Compact smart speaker with Alexa for music, smart home control, and "
        "everyday questions.",
        "49.00",
        150,
    ),
    (
        "TVS-SAM43U8000F",
        "tv-streaming",
        'Samsung 43" Crystal UHD U8000F 4K TV',
        "samsung-43-crystal-uhd-u8000f-4k-tv",
        "43-inch 4K UHD smart TV with Crystal Processor 4K and built-in " "streaming apps.",
        "379.00",
        20,
    ),
    (
        "TVS-ROKU50SEL",
        "tv-streaming",
        'Roku Select Series 50" 4K HDR TV',
        "roku-select-series-50-4k-hdr-tv",
        "50-inch 4K HDR smart TV running Roku OS with an enhanced voice remote.",
        "299.00",
        20,
    ),
    (
        "ACC-MXM3S",
        "accessories",
        "Logitech MX Master 3S",
        "logitech-mx-master-3s",
        "Advanced wireless mouse with quiet clicks, an 8K DPI sensor, and " "MagSpeed scrolling.",
        "99.00",
        70,
    ),
    (
        "ACC-KEYK2",
        "accessories",
        "Keychron K2 Mechanical Keyboard",
        "keychron-k2-mechanical-keyboard",
        "Compact 75% wireless mechanical keyboard compatible with Mac and " "Windows.",
        "99.00",
        55,
    ),
    (
        "ACC-BRIO4K",
        "accessories",
        "Logitech Brio 4K Webcam",
        "logitech-brio-4k-webcam",
        "4K Ultra HD webcam with HDR and autofocus for sharp video calls and " "streaming.",
        "199.00",
        38,
    ),
]


class Command(BaseCommand):
    help = "Seed the catalog with curated demo categories and products."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing products and categories before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["flush"]:
            deleted_products, _ = Product.objects.all().delete()
            deleted_categories, _ = Category.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(
                    f"Flushed existing catalog "
                    f"({deleted_products} products, {deleted_categories} categories)."
                )
            )

        categories_by_slug = {}
        cat_created = cat_updated = 0
        for slug, name, description in CATEGORIES:
            obj, created = Category.objects.update_or_create(
                slug=slug,
                defaults={"name": name, "description": description},
            )
            categories_by_slug[slug] = obj
            cat_created += int(created)
            cat_updated += int(not created)

        prod_created = prod_updated = 0
        for sku, category_slug, name, slug, description, price, stock in PRODUCTS:
            _, created = Product.objects.update_or_create(
                sku=sku,
                defaults={
                    "category": categories_by_slug[category_slug],
                    "name": name,
                    "slug": slug,
                    "description": description,
                    "price": Decimal(price),
                    "stock": stock,
                    "image": f"products/{sku}.png",
                    "is_active": True,
                },
            )
            prod_created += int(created)
            prod_updated += int(not created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Catalog seeded: "
                f"categories +{cat_created}/~{cat_updated}, "
                f"products +{prod_created}/~{prod_updated}."
            )
        )
