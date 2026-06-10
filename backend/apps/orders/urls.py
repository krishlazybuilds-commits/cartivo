from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, stripe_webhook

app_name = "orders"

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = router.urls + [
    path("orders/webhook/", stripe_webhook, name="stripe-webhook"),
]
