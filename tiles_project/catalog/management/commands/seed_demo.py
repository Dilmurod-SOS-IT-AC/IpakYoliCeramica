"""
Fills the database with demo data so students can play immediately:
    python manage.py seed_demo
Creates an admin user (admin / admin12345), tiles, a received shipment,
two sales and one return.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from catalog.models import Supplier, Tile, Warehouse
from inventory.models import Shipment, ShipmentItem
from inventory.services import receive_shipment
from sales.models import Customer
from sales.services import create_return, create_sale


class Command(BaseCommand):
    help = "Create demo data (admin user, tiles, shipment, sales, return)."

    def handle(self, *args, **options):
        if Tile.objects.exists():
            self.stdout.write(self.style.WARNING("Demo data already exists. Nothing to do."))
            return

        admin, created = User.objects.get_or_create(
            username="admin", defaults={"is_staff": True, "is_superuser": True},
        )
        if created:
            admin.set_password("admin12345")
            admin.save()

        supplier = Supplier.objects.create(name="Foshan Ceramics")
        warehouse = Warehouse.objects.create(code="MAIN", name="Main warehouse")

        tile_a = Tile.objects.create(code="A-6060", supplier=supplier, width_mm=600,
                                     height_mm=600, pieces_per_box=4,
                                     price_usd_per_m2=Decimal("11.50"), min_stock_pieces=40)
        tile_b = Tile.objects.create(code="B-3060", supplier=supplier, width_mm=300,
                                     height_mm=600, pieces_per_box=8,
                                     price_usd_per_m2=Decimal("8.90"), min_stock_pieces=80)

        shipment = Shipment.objects.create(number="SH-001", supplier=supplier,
                                           warehouse=warehouse, shipping_cost_usd=800,
                                           customs_cost_usd=400, created_by=admin)
        lot_a = ShipmentItem.objects.create(shipment=shipment, tile=tile_a, batch_code="B1",
                                            quantity_pieces=400,
                                            purchase_price_usd_per_m2=Decimal("6.00"))
        ShipmentItem.objects.create(shipment=shipment, tile=tile_b, batch_code="C7",
                                    quantity_pieces=800,
                                    purchase_price_usd_per_m2=Decimal("4.50"))
        receive_shipment(shipment, admin)

        akmal = Customer.objects.create(name="Akmal", type=Customer.Type.DEALER,
                                        phone="+998 90 123 45 67")
        Customer.objects.create(name="Mega Build LLC", type=Customer.Type.CONSTRUCTION)

        sale = create_sale(user=admin, warehouse=warehouse, customer=akmal,
                           exchange_rate=Decimal("12650"),
                           items=[{"tile": tile_a, "quantity": 10, "unit": "box",
                                   "lot": lot_a},
                                  {"tile": tile_b, "quantity": 5.5, "unit": "m2"}])
        create_sale(user=admin, warehouse=warehouse, exchange_rate=Decimal("12650"),
                    items=[{"tile": tile_a, "quantity": 12, "unit": "piece",
                            "discount_pct": 5, "lot": lot_a}])
        create_return(user=admin, sale=sale, reason="Wrong shade",
                      items=[{"sale_item": sale.items.first(), "quantity_pieces": 4}])

        self.stdout.write(self.style.SUCCESS(
            "Demo data created.\n"
            "  Login: admin / admin12345\n"
            f"  {tile_a.code} stock: {tile_a.stock_pieces()} pcs\n"
            f"  {tile_b.code} stock: {tile_b.stock_pieces()} pcs"
        ))
