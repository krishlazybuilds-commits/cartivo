from django.contrib import admin
from django.conf import settings

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
    actions = ["process_refund_action"]

    @admin.action(description="Process full refund via Stripe and restock items")
    def process_refund_action(self, request, queryset):
        import stripe
        from django.contrib import messages

        stripe.api_key = settings.STRIPE_SECRET_KEY

        success_count = 0
        for order in queryset:
            if order.status not in (
                Order.Status.PAID,
                Order.Status.SHIPPED,
                Order.Status.DELIVERED,
            ):
                self.message_user(
                    request,
                    f"Order {order.order_number_short} cannot be refunded because its status is {order.status}.",
                    level=messages.ERROR,
                )
                continue

            if order.stripe_payment_intent:
                try:
                    stripe.Refund.create(payment_intent=order.stripe_payment_intent)
                except stripe.error.StripeError as exc:
                    self.message_user(
                        request,
                        f"Stripe refund failed for Order {order.order_number_short}: {exc.user_message or str(exc)}",
                        level=messages.ERROR,
                    )
                    continue

            order.restock()
            order.status = Order.Status.REFUNDED
            order.save(update_fields=["status"])
            success_count += 1

        if success_count > 0:
            self.message_user(
                request,
                f"Successfully processed refunds and restocked items for {success_count} order(s).",
                level=messages.SUCCESS,
            )


@admin.register(StripeEvent)
class StripeEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("event_id",)
    readonly_fields = ("event_id", "event_type", "created_at")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "discount_type",
        "value",
        "times_used",
        "max_uses",
        "is_active",
        "valid_until",
    )
    list_filter = ("discount_type", "is_active")
    search_fields = ("code",)
