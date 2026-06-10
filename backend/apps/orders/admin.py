from django.contrib import admin

from .models import Order, OrderItem, StripeEvent


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "unit_price", "quantity")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "total", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__email", "shipping_full_name")
    inlines = [OrderItemInline]


@admin.register(StripeEvent)
class StripeEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("event_id",)
    readonly_fields = ("event_id", "event_type", "created_at")
