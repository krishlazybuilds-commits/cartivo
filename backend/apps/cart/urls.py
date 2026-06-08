from rest_framework.routers import DefaultRouter

from .views import CartItemViewSet, CartViewSet

app_name = "cart"

router = DefaultRouter()
router.register("cart", CartViewSet, basename="cart")
router.register("cart-items", CartItemViewSet, basename="cart-item")

urlpatterns = router.urls
