from django.urls import path
from .views import contact, subscribe

urlpatterns = [
    path("contact/", contact),
    path("newsletter/subscribe/", subscribe),
]
