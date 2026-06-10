from django.contrib import admin

from .models import Coupon, Order, OrderItem, StripeEvent


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "unit_price", "quantity")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number_short", "user", "status", "total", "discount", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("user__email", "shipping_full_name", "order_number")
    inlines = [OrderItemInline]


@admin.register(StripeEvent)
class StripeEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("event_id",)
    readonly_fields = ("event_id", "event_type", "created_at")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "value", "times_used", "max_uses", "is_active", "valid_until")
    list_filter = ("discount_type", "is_active")
    search_fields = ("code",)
