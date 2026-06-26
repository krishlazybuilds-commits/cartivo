from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"ai-studio/media", views.GeneratedMediaViewSet, basename="ai-studio-media")

urlpatterns = [
    path("ai-studio/generate/", views.generate_media, name="ai-studio-generate"),
    path("", include(router.urls)),
]
