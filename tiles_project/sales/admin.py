from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError

from .models import Customer, ReturnItem, Sale, SaleItem, SaleReturn
from .services import soft_delete_sale


class ReadOnlyAdmin(admin.ModelAdmin):
    """Sales and returns are created by services, never typed into the admin."""
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    can_delete = False
    readonly_fields = ["tile", "lot", "quantity_pieces", "price_usd_per_m2",
                       "discount_pct", "cost_usd_per_m2", "line_total_usd"]


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0
    can_delete = False
    readonly_fields = ["sale_item", "quantity_pieces", "condition"]


@admin.register(Sale)
class SaleAdmin(ReadOnlyAdmin):
    list_display = ["number", "customer", "warehouse", "total_usd", "created_by",
                    "created_at", "is_deleted"]
    list_select_related = ["customer", "warehouse", "created_by"]
    list_filter = ["warehouse", ("deleted_at", admin.EmptyFieldListFilter)]
    search_fields = ["number", "customer__name"]
    inlines = [SaleItemInline]
    actions = ["soft_delete"]

    @admin.display(boolean=True, description="Deleted")
    def is_deleted(self, obj):
        return obj.deleted_at is not None

    @admin.action(description="Soft delete (admin only, stock is returned)")
    def soft_delete(self, request, queryset):
        for sale in queryset:
            try:
                soft_delete_sale(user=request.user, sale=sale,
                                 reason="Deleted from the admin panel")
                self.message_user(request, f"{sale.number}: deleted, stock returned.")
            except (PermissionDenied, ValidationError) as exc:
                text = exc.messages[0] if hasattr(exc, "messages") else str(exc)
                self.message_user(request, f"{sale.number}: {text}", level=messages.ERROR)


@admin.register(SaleReturn)
class SaleReturnAdmin(ReadOnlyAdmin):
    list_display = ["number", "sale", "refund_usd", "created_by", "created_at"]
    list_select_related = ["sale", "created_by"]
    search_fields = ["number", "sale__number"]
    inlines = [ReturnItemInline]


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "type", "phone"]
    list_filter = ["type"]
    search_fields = ["name", "phone"]
