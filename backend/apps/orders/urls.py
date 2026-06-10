from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, ShippingEstimateView, stripe_webhook

app_name = "orders"

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("orders/webhook/", stripe_webhook, name="stripe-webhook"),
    path("shipping-estimate/", ShippingEstimateView.as_view(), name="shipping-estimate"),
] + router.urls
