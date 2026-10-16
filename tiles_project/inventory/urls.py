from django.urls import path
from . import views

urlpatterns = [
    path(
        "summary/",
        views.inventory_summary,
        name = "inventory-summary",
    ),
]

