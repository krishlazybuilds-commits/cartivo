from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .assets import auth_video
from .health import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth-video/", auth_video, name="auth-video"),
]

# OpenAPI schema + interactive docs — only exposed in DEBUG mode to reduce
# attack surface in production. Admins can still generate the schema locally
# via `python manage.py spectacular`.
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]

urlpatterns += [
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.cart.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.contact.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
