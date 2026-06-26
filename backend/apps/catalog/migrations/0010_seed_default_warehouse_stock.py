from django.db import migrations


def seed_warehouse_and_stock(apps, schema_editor):
    Warehouse = apps.get_model("catalog", "Warehouse")
    WarehouseStock = apps.get_model("catalog", "WarehouseStock")
    Product = apps.get_model("catalog", "Product")
    ProductVariant = apps.get_model("catalog", "ProductVariant")

    # Create default warehouse
    central, created = Warehouse.objects.get_or_create(
        code="CENTRAL",
        defaults={
            "name": "Central Warehouse",
            "address": "100 Main St, Metropolis",
            "is_active": True,
        },
    )

    # Seed stock for products without variants
    for product in Product.objects.all():
        # Check if product has variants
        if not ProductVariant.objects.filter(product=product).exists():
            WarehouseStock.objects.get_or_create(
                warehouse=central, product=product, variant=None, defaults={"stock": product.stock}
            )

    # Seed stock for product variants
    for variant in ProductVariant.objects.all():
        WarehouseStock.objects.get_or_create(
            warehouse=central,
            product=variant.product,
            variant=variant,
            defaults={"stock": variant.stock},
        )


def rollback_warehouse_and_stock(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0009_warehouse_warehousestock"),
    ]

    operations = [
        migrations.RunPython(seed_warehouse_and_stock, rollback_warehouse_and_stock),
    ]
