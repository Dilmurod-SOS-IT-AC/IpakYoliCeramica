from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .models import Shipment, ShipmentItem, StockMovement
from .services import receive_shipment


class ShipmentItemInline(admin.TabularInline):
    model = ShipmentItem
    extra = 1
    autocomplete_fields = ["tile"]            # needs search_fields on TileAdmin
    readonly_fields = ["landed_cost_usd_per_m2"]


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ["number", "supplier", "warehouse", "status", "arrival_date", "created_by"]
    list_select_related = ["supplier", "warehouse", "created_by"]
    list_filter = ["status", "supplier"]
    search_fields = ["number"]
    inlines = [ShipmentItemInline]
    exclude = ["created_by"]
    actions = ["receive"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user     # fill the FK from the logged-in user
        super().save_model(request, obj, form, change)

    @admin.action(description="Receive selected shipments (add to stock)")
    def receive(self, request, queryset):
        for shipment in queryset:
            try:
                receive_shipment(shipment, request.user)
                self.message_user(request, f"{shipment.number}: received.")
            except ValidationError as exc:
                self.message_user(request, f"{shipment.number}: {exc.messages[0]}",
                                  level=messages.ERROR)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    """A ledger is read-only: you can look, never touch."""
    list_display = ["created_at", "type", "tile", "warehouse", "quantity_pieces", "created_by"]
    list_select_related = ["tile", "warehouse", "created_by"]
    list_filter = ["type", "warehouse"]
    search_fields = ["tile__code"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
