from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ProductViewSet, ReviewViewSet, WishlistItemViewSet

app_name = "catalog"

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("reviews", ReviewViewSet, basename="review")
router.register("wishlist", WishlistItemViewSet, basename="wishlist")

urlpatterns = router.urls
