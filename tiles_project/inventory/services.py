"""Business logic. Views, admin, shell and (later) the bot all call these."""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Shipment, StockMovement


@transaction.atomic   # all writes succeed together, or none of them do
def receive_shipment(shipment: Shipment, user) -> Shipment:
    """Put a shipment into stock and spread shipping + customs over its items."""
    if shipment.status == Shipment.Status.ARRIVED:
        raise ValidationError("Shipment has already been received.")

    items = list(shipment.items.select_related("tile"))   # reverse FK + JOIN tile
    if not items:
        raise ValidationError("Shipment has no items.")

    total_m2 = sum((i.tile.m2_per_piece * i.quantity_pieces for i in items), Decimal(0))
    extra_cost = shipment.shipping_cost_usd + shipment.customs_cost_usd
    extra_per_m2 = (extra_cost / total_m2) if total_m2 else Decimal(0)

    for item in items:
        item.landed_cost_usd_per_m2 = (
            item.purchase_price_usd_per_m2 + extra_per_m2
        ).quantize(Decimal("0.0001"))
        item.save(update_fields=["landed_cost_usd_per_m2"])

        StockMovement.objects.create(
            type=StockMovement.Type.INCOMING,
            tile=item.tile,
            warehouse=shipment.warehouse,
            quantity_pieces=item.quantity_pieces,
            lot=item,
            created_by=user,
        )

    shipment.status = Shipment.Status.ARRIVED
    shipment.save(update_fields=["status"])
    return shipment
