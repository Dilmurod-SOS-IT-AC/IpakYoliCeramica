"""URL patterns for the React frontend API. Copy into config/api_urls.py."""
from django.urls import include, path
from . import api_views

urlpatterns = [
    path("csrf/", api_views.csrf_cookie, name="api-csrf"),
    path("auth/me/", api_views.auth_me, name="api-auth-me"),
    path("auth/login/", api_views.auth_login, name="api-auth-login"),
    path("auth/logout/", api_views.auth_logout, name="api-auth-logout"),
    path("dashboard/", api_views.dashboard, name="api-dashboard"),
    path("tiles/", api_views.tiles_list, name="api-tiles"),
    path("suppliers/", api_views.suppliers_list, name="api-suppliers"),
    path("warehouses/", api_views.warehouses_list, name="api-warehouses"),
    path("customers/", api_views.customers_list, name="api-customers"),
    path("stock-movements/", api_views.stock_movements_list, name="api-stock-movements"),
    path("sales/", api_views.sales_list_create, name="api-sales"),
    path("shipments/", api_views.shipments_list_create, name="api-shipments"),
    path("shipments/<int:shipment_id>/receive/", api_views.receive_shipment_view, name="api-shipment-receive"),
    path("inventory/", include("inventory.urls")),
]
