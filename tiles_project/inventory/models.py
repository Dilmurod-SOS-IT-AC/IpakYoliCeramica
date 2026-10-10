"""
LESSONS IN THIS FILE
  * CASCADE vs PROTECT in one chain (Shipment -> ShipmentItem -> StockMovement)
  * Lazy FK to another app written as a string: "sales.SaleItem" (avoids circular imports)
  * Optional (nullable) foreign keys
  * Blocking hard deletes on BOTH the model and the queryset
"""
from django.conf import settings
from django.db import models
from django.db.models import Q


class AppendOnlyQuerySet(models.QuerySet):
    """
    QuerySet.delete() does NOT call Model.delete() - it runs one SQL DELETE.
    So to make records permanent we must block both places.
    """
    def delete(self):
        raise PermissionError("These records are permanent. Hard delete is not allowed.")


class Shipment(models.Model):
    """One container arriving from China."""
    class Status(models.TextChoices):
        ORDERED = "ordered", "Ordered"
        IN_TRANSIT = "in_transit", "In transit"
        ARRIVED = "arrived", "Arrived"

    number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey("catalog.Supplier", on_delete=models.PROTECT,
                                 related_name="shipments")
    warehouse = models.ForeignKey("catalog.Warehouse", on_delete=models.PROTECT,
                                  related_name="shipments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ORDERED)
    arrival_date = models.DateField(null=True, blank=True)
    shipping_cost_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    customs_cost_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    exchange_rate = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="shipments_created")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class ShipmentItem(models.Model):
    """One line of a shipment = one LOT (batch / shade / caliber)."""
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="items")
    tile = models.ForeignKey("catalog.Tile", on_delete=models.PROTECT,
                             related_name="shipment_items")
    batch_code = models.CharField(max_length=50, blank=True)
    quantity_pieces = models.PositiveIntegerField()
    purchase_price_usd_per_m2 = models.DecimalField(max_digits=12, decimal_places=4)
    # purchase price + its share of shipping and customs (filled in when received)
    landed_cost_usd_per_m2 = models.DecimalField(max_digits=12, decimal_places=4,
                                                 null=True, blank=True)

    class Meta:
        constraints = [
            # the same tile + batch cannot appear twice in one shipment
            models.UniqueConstraint(fields=["shipment", "tile", "batch_code"],
                                    name="unique_lot_per_shipment"),
            models.CheckConstraint(condition=Q(quantity_pieces__gt=0),
                                   name="shipment_qty_positive"),
        ]

    def __str__(self):
        return f"{self.shipment.number} / {self.tile.code} / {self.batch_code or '-'}"


class StockMovement(models.Model):
    """
    The ONLY place quantities live. Current stock = SUM(quantity_pieces).
    Nothing ever edits a stock number: we only append + and - rows.
    """
    class Type(models.TextChoices):
        INCOMING = "incoming", "Incoming"
        SALE = "sale", "Sale"
        RETURN = "return", "Return"
        WRITE_OFF = "write_off", "Write-off"
        ADJUSTMENT = "adjustment", "Adjustment"

    type = models.CharField(max_length=20, choices=Type.choices)
    tile = models.ForeignKey("catalog.Tile", on_delete=models.PROTECT, related_name="movements")
    warehouse = models.ForeignKey("catalog.Warehouse", on_delete=models.PROTECT,
                                  related_name="movements")
    quantity_pieces = models.IntegerField()   # + into stock, - out of stock

    # Optional FKs: which document caused this movement (only one of them is filled).
    # The sales models are written as STRINGS so inventory does not import sales
    # while sales imports inventory -> no circular import.
    lot = models.ForeignKey(ShipmentItem, null=True, blank=True,
                            on_delete=models.PROTECT, related_name="movements")
    sale_item = models.ForeignKey("sales.SaleItem", null=True, blank=True,
                                  on_delete=models.PROTECT, related_name="movements")
    return_item = models.ForeignKey("sales.ReturnItem", null=True, blank=True,
                                    on_delete=models.PROTECT, related_name="movements")

    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="stock_movements")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AppendOnlyQuerySet.as_manager()   # blocks .filter(...).delete()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["tile", "warehouse"])]
        constraints = [
            models.CheckConstraint(condition=~Q(quantity_pieces=0), name="movement_not_zero"),
        ]

    def delete(self, *args, **kwargs):          # blocks obj.delete()
        raise PermissionError("Stock movements are permanent.")

    def __str__(self):
        return f"{self.type} {self.quantity_pieces:+} {self.tile.code}"
