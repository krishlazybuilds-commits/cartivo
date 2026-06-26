from django.contrib import admin

from .models import Category, Product, ProductImage, ProductVariant, Warehouse, WarehouseStock


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0


class WarehouseStockInline(admin.TabularInline):
    model = WarehouseStock
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price",
        "stock",
        "is_active",
        "is_featured",
        "is_new",
        "on_sale",
    )
    list_filter = ("is_active", "is_featured", "is_new", "on_sale", "category")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "sku")
    inlines = [ProductImageInline, ProductVariantInline, WarehouseStockInline]


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    inlines = [WarehouseStockInline]


@admin.register(WarehouseStock)
class WarehouseStockAdmin(admin.ModelAdmin):
    list_display = ("warehouse", "product", "variant", "stock")
    list_filter = ("warehouse", "product")
    search_fields = ("product__name", "variant__name", "warehouse__name")
