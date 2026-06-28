from django.urls import path
from .views import contact, subscribe, unsubscribe

urlpatterns = [
    path("contact/", contact),
    path("newsletter/subscribe/", subscribe),
    path("newsletter/unsubscribe/<uuid:token>/", unsubscribe),
]
