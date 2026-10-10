"""
Tests that double as lessons. Run them with:  python manage.py test
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import ProtectedError
from django.test import TestCase

from catalog.models import Supplier, Tile, Warehouse
from inventory.models import Shipment, ShipmentItem, StockMovement
from inventory.services import receive_shipment
from sales.models import Customer, Sale
from sales.services import create_return, create_sale, soft_delete_sale


class TileSystemTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin", password="x")
        self.seller = User.objects.create_user("seller", password="x")
        self.supplier = Supplier.objects.create(name="Foshan")
        self.warehouse = Warehouse.objects.create(code="MAIN", name="Main")
        self.tile = Tile.objects.create(code="A-6060", supplier=self.supplier, width_mm=600,
                                        height_mm=600, pieces_per_box=4,
                                        price_usd_per_m2=Decimal("10.00"))
        shipment = Shipment.objects.create(number="SH-1", supplier=self.supplier,
                                           warehouse=self.warehouse, created_by=self.admin)
        self.lot = ShipmentItem.objects.create(shipment=shipment, tile=self.tile,
                                               quantity_pieces=100,
                                               purchase_price_usd_per_m2=Decimal("5"))
        receive_shipment(shipment, self.admin)

    # ---------- units ----------
    def test_unit_conversion(self):
        self.assertEqual(self.tile.m2_per_piece, Decimal("0.36"))
        info = self.tile.describe_pieces(10)
        self.assertEqual((info["boxes"], info["loose_pieces"]), (2, 2))

    def test_stock_after_receiving(self):
        self.assertEqual(self.tile.stock_pieces(), 100)

    # ---------- sales ----------
    def test_sale_reduces_stock(self):
        create_sale(user=self.seller, warehouse=self.warehouse,
                    exchange_rate=Decimal("12000"),
                    items=[{"tile": self.tile, "quantity": 5, "unit": "box"}])
        self.assertEqual(self.tile.stock_pieces(), 80)

    def test_sale_over_stock_is_rolled_back(self):
        with self.assertRaises(ValidationError):
            create_sale(user=self.seller, warehouse=self.warehouse,
                        exchange_rate=Decimal("12000"),
                        items=[{"tile": self.tile, "quantity": 500, "unit": "piece"}])
        # @transaction.atomic rolled everything back
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(self.tile.stock_pieces(), 100)

    # ---------- returns ----------
    def test_return_restores_stock(self):
        sale = create_sale(user=self.seller, warehouse=self.warehouse,
                           exchange_rate=Decimal("12000"),
                           items=[{"tile": self.tile, "quantity": 20, "unit": "piece"}])
        create_return(user=self.seller, sale=sale,
                      items=[{"sale_item": sale.items.first(), "quantity_pieces": 5}])
        self.assertEqual(self.tile.stock_pieces(), 85)

    def test_cannot_return_more_than_sold(self):
        sale = create_sale(user=self.seller, warehouse=self.warehouse,
                           exchange_rate=Decimal("12000"),
                           items=[{"tile": self.tile, "quantity": 10, "unit": "piece"}])
        with self.assertRaises(ValidationError):
            create_return(user=self.seller, sale=sale,
                          items=[{"sale_item": sale.items.first(), "quantity_pieces": 11}])

    # ---------- permanence ----------
    def test_hard_delete_is_blocked(self):
        sale = create_sale(user=self.seller, warehouse=self.warehouse,
                           exchange_rate=Decimal("12000"),
                           items=[{"tile": self.tile, "quantity": 4, "unit": "piece"}])
        with self.assertRaises(PermissionError):
            sale.delete()
        with self.assertRaises(PermissionError):
            Sale.objects.all().delete()          # bulk path is blocked too
        with self.assertRaises(PermissionError):
            StockMovement.objects.all().delete()

    def test_only_admin_can_soft_delete(self):
        sale = create_sale(user=self.seller, warehouse=self.warehouse,
                           exchange_rate=Decimal("12000"),
                           items=[{"tile": self.tile, "quantity": 8, "unit": "piece"}])
        with self.assertRaises(PermissionDenied):
            soft_delete_sale(user=self.seller, sale=sale, reason="oops")

        soft_delete_sale(user=self.admin, sale=sale, reason="Entered by mistake")
        sale.refresh_from_db()
        self.assertIsNotNone(sale.deleted_at)
        self.assertEqual(Sale.objects.alive().count(), 0)
        self.assertEqual(Sale.objects.deleted().count(), 1)   # still in the database
        self.assertEqual(self.tile.stock_pieces(), 100)       # stock given back

    # ---------- on_delete ----------
    def test_protect_blocks_supplier_delete(self):
        with self.assertRaises(ProtectedError):
            self.supplier.delete()

    def test_set_null_keeps_the_sale(self):
        customer = Customer.objects.create(name="Akmal")
        sale = create_sale(user=self.seller, warehouse=self.warehouse, customer=customer,
                           exchange_rate=Decimal("12000"),
                           items=[{"tile": self.tile, "quantity": 4, "unit": "piece"}])
        customer.delete()
        sale.refresh_from_db()
        self.assertIsNone(sale.customer)       # sale survived, FK became NULL
