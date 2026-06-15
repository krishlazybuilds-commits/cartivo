from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ProductImageViewSet, ProductVariantViewSet, ProductViewSet, ReviewViewSet, WishlistItemViewSet

app_name = "catalog"

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("product-images", ProductImageViewSet, basename="product-image")
router.register("variants", ProductVariantViewSet, basename="variant")
router.register("reviews", ReviewViewSet, basename="review")
router.register("wishlist", WishlistItemViewSet, basename="wishlist")

urlpatterns = router.urls
