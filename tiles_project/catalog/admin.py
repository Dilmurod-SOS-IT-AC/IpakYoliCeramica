from django.contrib import admin
from django.db.models import Sum
from django.db.models.functions import Coalesce

from .models import Supplier, Tile, TileImage, Warehouse


class TileImageInline(admin.TabularInline):
    # An inline works because TileImage has a ForeignKey to Tile
    model = TileImage
    extra = 1


@admin.register(Tile)
class TileAdmin(admin.ModelAdmin):
    list_display = ["code", "size_label", "supplier", "pieces_per_box",
                    "price_usd_per_m2", "stock_col", "stock_m2_col"]
    list_select_related = ["supplier"]            # 1 query with a JOIN, not N queries
    list_filter = ["supplier", "is_active"]
    search_fields = ["code", "supplier__name"]    # search THROUGH the foreign key
    inlines = [TileImageInline]

    def get_queryset(self, request):
        # Stock for every row is calculated by the database in a single query
        return super().get_queryset(request).annotate(
            stock=Coalesce(Sum("movements__quantity_pieces"), 0)
        )

    @admin.display(description="Stock (pcs)", ordering="stock")
    def stock_col(self, obj):
        return obj.stock

    @admin.display(description="Stock (m2)")
    def stock_m2_col(self, obj):
        return obj.describe_pieces(obj.stock)["m2"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "country"]
    search_fields = ["name"]


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ["code", "name"]
