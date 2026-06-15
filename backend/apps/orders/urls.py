from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import GuestCheckoutView, OrderViewSet, ShippingEstimateView, ValidateCouponView, stripe_webhook

app_name = "orders"

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("orders/webhook/", stripe_webhook, name="stripe-webhook"),
    path("orders/guest-checkout/", GuestCheckoutView.as_view(), name="guest-checkout"),
    path("shipping-estimate/", ShippingEstimateView.as_view(), name="shipping-estimate"),
    path("coupons/validate/", ValidateCouponView.as_view(), name="validate-coupon"),
] + router.urls
