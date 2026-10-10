"""
All writes go through here, so stock can never get out of sync with sales.
@transaction.atomic = everything in the function succeeds, or nothing does.
"""
import math
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import is_admin
from catalog.models import Tile
from inventory.models import StockMovement

from .models import ReturnItem, Sale, SaleItem, SaleReturn

CENT = Decimal("0.01")


def next_number(prefix: str) -> str:
    return f"{prefix}-{timezone.now():%Y%m%d-%H%M%S%f}"


def to_pieces(tile: Tile, quantity, unit: str) -> int:
    """Any unit -> pieces. Square metres are rounded UP to whole pieces."""
    q = Decimal(str(quantity))
    if unit == "piece":
        return int(q)
    if unit == "box":
        return int(q * tile.pieces_per_box)
    if unit == "m2":
        return math.ceil(q / tile.m2_per_piece)
    raise ValueError(f"Unknown unit: {unit}")


@transaction.atomic
def create_sale(*, user, warehouse, exchange_rate, items, customer=None) -> Sale:
    """
    items = [{"tile": Tile, "quantity": 10, "unit": "box",
              "discount_pct": 0, "lot": ShipmentItem or None}, ...]
    """
    if not items:
        raise ValidationError("A sale needs at least one item.")

    sale = Sale.objects.create(
        number=next_number("S"), customer=customer, warehouse=warehouse,
        exchange_rate=Decimal(str(exchange_rate)), created_by=user,
    )
    total = Decimal(0)

    for row in items:
        # Lock this tile's row until the transaction ends, so two sellers
        # cannot both pass the stock check for the same last boxes.
        tile = Tile.objects.select_for_update().get(pk=row["tile"].pk)
        pieces = to_pieces(tile, row["quantity"], row.get("unit", "piece"))
        available = tile.stock_pieces(warehouse)
        if pieces > available:
            raise ValidationError(
                f"{tile.code}: {pieces} pcs requested, only {available} pcs in stock."
            )

        discount = Decimal(str(row.get("discount_pct", 0)))
        m2 = tile.m2_per_piece * pieces
        line_total = (m2 * tile.price_usd_per_m2 * (1 - discount / 100)
                      ).quantize(CENT, ROUND_HALF_UP)
        lot = row.get("lot")

        item = SaleItem.objects.create(
            sale=sale, tile=tile, lot=lot, quantity_pieces=pieces,
            price_usd_per_m2=tile.price_usd_per_m2,   # freeze the price of today
            discount_pct=discount,
            cost_usd_per_m2=lot.landed_cost_usd_per_m2 if lot else None,
            line_total_usd=line_total,
        )
        StockMovement.objects.create(
            type=StockMovement.Type.SALE, tile=tile, warehouse=warehouse,
            quantity_pieces=-pieces, lot=lot, sale_item=item, created_by=user,
        )
        total += line_total

    sale.total_usd = total
    sale.save(update_fields=["total_usd"])
    return sale


@transaction.atomic
def create_return(*, user, sale: Sale, items, reason="") -> SaleReturn:
    """items = [{"sale_item": SaleItem, "quantity_pieces": 4, "condition": "resellable"}]"""
    if sale.deleted_at:
        raise ValidationError("Cannot return items from a deleted sale.")

    ret = SaleReturn.objects.create(number=next_number("R"), sale=sale,
                                    reason=reason, created_by=user)
    refund = Decimal(0)

    for row in items:
        sale_item = row["sale_item"]
        # Comparing the FK column with the PK costs no extra query
        if sale_item.sale_id != sale.pk:
            raise ValidationError("That item does not belong to this sale.")

        qty = int(row["quantity_pieces"])
        can_return = sale_item.quantity_pieces - sale_item.returned_pieces
        if qty > can_return:
            raise ValidationError(
                f"{sale_item.tile.code}: only {can_return} pcs can still be returned."
            )

        condition = row.get("condition", ReturnItem.Condition.RESELLABLE)
        return_item = ReturnItem.objects.create(
            sale_return=ret, sale_item=sale_item, quantity_pieces=qty, condition=condition,
        )
        if condition == ReturnItem.Condition.RESELLABLE:
            StockMovement.objects.create(
                type=StockMovement.Type.RETURN, tile=sale_item.tile,
                warehouse=sale.warehouse, quantity_pieces=qty, lot=sale_item.lot,
                return_item=return_item, created_by=user,
            )
        refund += (sale_item.line_total_usd * qty / sale_item.quantity_pieces
                   ).quantize(CENT, ROUND_HALF_UP)

    ret.refund_usd = refund
    ret.save(update_fields=["refund_usd"])
    return ret


@transaction.atomic
def soft_delete_sale(*, user, sale: Sale, reason: str) -> Sale:
    """Admin only. The sale stays in the database; stock is returned by reversing rows."""
    if not is_admin(user):
        raise PermissionDenied("Only an admin can delete sales.")
    if sale.deleted_at:
        raise ValidationError("This sale is already deleted.")
    if not reason:
        raise ValidationError("A reason is required.")

    for sale_item in sale.items.select_related("tile"):
        remaining = sale_item.quantity_pieces - sale_item.returned_pieces
        if remaining > 0:
            StockMovement.objects.create(
                type=StockMovement.Type.ADJUSTMENT, tile=sale_item.tile,
                warehouse=sale.warehouse, quantity_pieces=remaining, lot=sale_item.lot,
                sale_item=sale_item, created_by=user,
                note=f"Reversal of deleted sale {sale.number}",
            )

    sale.deleted_at = timezone.now()
    sale.deleted_by = user
    sale.delete_reason = reason
    sale.save(update_fields=["deleted_at", "deleted_by", "delete_reason"])
    return sale
