"""
LESSONS IN THIS FILE
  * Automatic primary key  -> Supplier, Tile, TileImage
  * Natural primary key    -> Warehouse.code ("MAIN" is the PK itself)
  * unique=True is NOT a primary key -> Tile.code
  * ForeignKey + related_name + on_delete=PROTECT / CASCADE
  * Derived values (m2) are calculated, never stored twice
"""
from decimal import Decimal

from django.db import models
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

M2_PRECISION = Decimal("0.001")   # round square metres to 3 decimals


class Supplier(models.Model):
    # No primary key declared -> Django adds: id = BigAutoField(primary_key=True)
    name = models.CharField(max_length=150)
    country = models.CharField(max_length=60, default="China")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Warehouse(models.Model):
    # NATURAL primary key: the code itself is the PK.
    # Every FK pointing here stores the string "MAIN", not a number.
    code = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.code} - {self.name}"


class Tile(models.Model):
    # Surrogate PK "id" (automatic) + business key "code" (unique, but NOT the PK,
    # because a business code may change one day and a PK never should).
    code = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,   # a supplier with tiles cannot be deleted
        related_name="tiles",       # reverse access: supplier.tiles.all()
    )
    width_mm = models.PositiveIntegerField()
    height_mm = models.PositiveIntegerField()
    pieces_per_box = models.PositiveIntegerField()
    price_usd_per_m2 = models.DecimalField(max_digits=10, decimal_places=2)
    min_stock_pieces = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=Q(width_mm__gt=0) & Q(height_mm__gt=0) & Q(pieces_per_box__gt=0),
                name="tile_sizes_positive",
            ),
        ]

    def __str__(self):
        return f"{self.code} ({self.size_label})"

    # ---------- derived values: one source of truth ----------
    @property
    def size_label(self) -> str:
        return f"{self.width_mm}x{self.height_mm}"

    @property
    def m2_per_piece(self) -> Decimal:
        return Decimal(self.width_mm * self.height_mm) / Decimal(1_000_000)

    @property
    def m2_per_box(self) -> Decimal:
        return self.m2_per_piece * self.pieces_per_box

    def describe_pieces(self, pieces: int) -> dict:
        """Pieces -> boxes + loose pieces + square metres."""
        boxes, loose = divmod(pieces, self.pieces_per_box)
        return {
            "pieces": pieces,
            "boxes": boxes,
            "loose_pieces": loose,
            "m2": (self.m2_per_piece * pieces).quantize(M2_PRECISION),
        }

    def stock_pieces(self, warehouse=None) -> int:
        """Stock = SUM of all movements. Coalesce turns SUM(no rows) = NULL into 0."""
        qs = self.movements.all()        # reverse FK from inventory.StockMovement
        if warehouse is not None:
            qs = qs.filter(warehouse=warehouse)
        return qs.aggregate(total=Coalesce(Sum("quantity_pieces"), 0))["total"]


class TileImage(models.Model):
    tile = models.ForeignKey(
        Tile,
        on_delete=models.CASCADE,   # an image is part of the tile -> deleted with it
        related_name="images",      # tile.images.all()
    )
    image = models.ImageField(upload_to="tiles/")
    is_main = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image of {self.tile.code}"
