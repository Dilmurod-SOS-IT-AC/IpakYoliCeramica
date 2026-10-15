from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView

from sales.reports import sales_report_xlsx

urlpatterns = [
path("", RedirectView.as_view(url="/sales/", permanent=False)),
path("admin/", admin.site.urls),
path("sales/", include("sales.urls")),
path("reports/sales.xlsx", sales_report_xlsx, name="sales-report"),
]

if settings.DEBUG:
    urlpatterns += static(
    settings.MEDIA_URL,
    document_root=settings.MEDIA_ROOT,
)
