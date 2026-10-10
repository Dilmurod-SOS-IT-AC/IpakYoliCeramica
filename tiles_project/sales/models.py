"""
LESSONS IN THIS FILE
  * ManyToManyField with through= (the junction model has extra columns)
  * TWO foreign keys to the same model -> related_name is required
  * on_delete=SET_NULL (deleting a customer must not delete the sale)
  * Soft delete: deleted_at / deleted_by instead of a real DELETE
"""
from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from inventory.models import AppendOnlyQuerySet


class Customer(models.Model):
    class Type(models.TextChoices):
        RETAIL = "retail", "Retail"
        DEALER = "dealer", "Dealer"
        CONSTRUCTION = "construction", "Construction company"

    name = models.CharField(max_length=150)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.RETAIL)
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SaleQuerySet(AppendOnlyQuerySet):
    """Custom methods added here are chainable: Sale.objects.alive().filter(...)"""
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)


class Sale(models.Model):
    number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        Customer, null=True, blank=True,
        on_delete=models.SET_NULL,     # customer deleted -> sale stays, becomes walk-in
        related_name="sales",
    )
    warehouse = models.ForeignKey("catalog.Warehouse", on_delete=models.PROTECT,
                                  related_name="sales")
    # Many-to-many THROUGH an explicit model that carries quantity and price
    tiles = models.ManyToManyField("catalog.Tile", through="SaleItem", related_name="sales")

    exchange_rate = models.DecimalField(max_digits=14, decimal_places=4)  # USD->UZS snapshot
    total_usd = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # TWO foreign keys to the same model (User). Without different related_name
    # values Django raises: "reverse accessor clashes".
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="sales_created")
    created_at = models.DateTimeField(auto_now_add=True)

    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.PROTECT, related_name="sales_deleted")
    delete_reason = models.TextField(blank=True)

    objects = SaleQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def delete(self, *args, **kwargs):
        raise PermissionError("Sales are permanent. Use sales.services.soft_delete_sale().")

    @property
    def total_uzs(self):
        return (self.total_usd * self.exchange_rate).quantize(1)

    def __str__(self):
        return self.number


class SaleItem(models.Model):
    """Junction model of the Sale <-> Tile many-to-many, plus its own columns."""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    tile = models.ForeignKey("catalog.Tile", on_delete=models.PROTECT, related_name="sale_items")
    lot = models.ForeignKey("inventory.ShipmentItem", null=True, blank=True,
                            on_delete=models.PROTECT, related_name="sale_items")
    quantity_pieces = models.PositiveIntegerField()
    price_usd_per_m2 = models.DecimalField(max_digits=10, decimal_places=2)   # price snapshot
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cost_usd_per_m2 = models.DecimalField(max_digits=12, decimal_places=4,
                                          null=True, blank=True)              # cost snapshot
    line_total_usd = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(quantity_pieces__gt=0), name="sale_qty_positive"),
            models.CheckConstraint(condition=Q(discount_pct__gte=0) & Q(discount_pct__lte=100),
                                   name="discount_between_0_and_100"),
        ]

    @property
    def m2(self):
        return self.tile.describe_pieces(self.quantity_pieces)["m2"]

    @property
    def returned_pieces(self) -> int:
        return self.return_items.aggregate(t=Coalesce(Sum("quantity_pieces"), 0))["t"]

    def __str__(self):
        return f"{self.sale.number}: {self.tile.code} x {self.quantity_pieces}"


class SaleReturn(models.Model):
    """Named SaleReturn because 'return' is a Python keyword."""
    number = models.CharField(max_length=50, unique=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="returns")
    reason = models.TextField(blank=True)
    refund_usd = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="returns_created")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]

    def delete(self, *args, **kwargs):
        raise PermissionError("Returns are permanent.")

    def __str__(self):
        return self.number


class ReturnItem(models.Model):
    class Condition(models.TextChoices):
        RESELLABLE = "resellable", "Resellable (back to stock)"
        DAMAGED = "damaged", "Damaged (not restocked)"

    sale_return = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey(SaleItem, on_delete=models.PROTECT, related_name="return_items")
    quantity_pieces = models.PositiveIntegerField()
    condition = models.CharField(max_length=20, choices=Condition.choices,
                                 default=Condition.RESELLABLE)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(quantity_pieces__gt=0),
                                   name="return_qty_positive"),
        ]

    def __str__(self):
        return f"{self.sale_return.number}: {self.sale_item.tile.code} x {self.quantity_pieces}"
