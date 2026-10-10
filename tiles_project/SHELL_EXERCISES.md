# Shell exercises

Start with a clean database:

```bat
python manage.py migrate
python manage.py seed_demo
python manage.py shell
```

## 0. Imports

```python
from decimal import Decimal
from django.contrib.auth.models import User
from catalog.models import Supplier, Warehouse, Tile
from inventory.models import Shipment, ShipmentItem, StockMovement
from inventory.services import receive_shipment
from sales.models import Customer, Sale, SaleItem
from sales.services import create_sale, create_return, soft_delete_sale

admin = User.objects.get(username="admin")
wh = Warehouse.objects.get(code="MAIN")
t1 = Tile.objects.get(code="A-6060")
t2 = Tile.objects.get(code="B-3060")
```

## 1. Primary keys

```python
t1.pk, t1.id            # the same automatic BigAutoField
wh.pk                   # 'MAIN' -> a natural string PK
Tile.objects.get(pk="A-6060")      # error: the PK of Tile is a number
Tile.objects.get(code="A-6060")    # unique field, but not the PK
```

## 2. Units are always consistent

```python
t1.m2_per_piece, t1.m2_per_box
t1.describe_pieces(t1.stock_pieces())
t2.describe_pieces(100)
```

## 3. Foreign keys: forward and reverse

```python
sale = Sale.objects.first()
item = sale.items.first()      # reverse FK (related_name="items")
item.sale                      # forward FK -> a Sale object (runs a query)
item.sale_id                   # just the column value (no query)
t1.supplier                    # forward
t1.supplier.tiles.all()        # reverse
admin.sales_created.all()      # first FK to User
admin.sales_deleted.all()      # second FK to User
```

## 4. Many-to-many through

```python
sale.tiles.all()               # tiles in this sale (through SaleItem)
t1.sales.all()                 # every sale containing this tile
SaleItem.objects.filter(sale=sale).values("tile__code", "quantity_pieces")
```

## 5. Filtering across relations with __

```python
Tile.objects.filter(supplier__name__icontains="foshan")
Sale.objects.filter(items__tile__code="A-6060").distinct()
SaleItem.objects.filter(sale__customer__name="Akmal")
print(Tile.objects.filter(supplier__name="Foshan Ceramics").query)   # see the JOIN
```

## 6. The N+1 problem

```python
from django.db import connection, reset_queries
from django.conf import settings
settings.DEBUG = True

reset_queries()
[si.tile.code for si in SaleItem.objects.all()]
len(connection.queries)        # 1 + N

reset_queries()
[si.tile.code for si in SaleItem.objects.select_related("tile")]
len(connection.queries)        # 1
```

## 7. Selling in different units

```python
akmal = Customer.objects.get(name="Akmal")
lot = ShipmentItem.objects.get(tile=t1)

before = t1.stock_pieces()
s = create_sale(user=admin, warehouse=wh, customer=akmal, exchange_rate=Decimal("12650"),
                items=[{"tile": t1, "quantity": 2, "unit": "box", "lot": lot},
                       {"tile": t2, "quantity": 7.2, "unit": "m2"}])
s.number, s.total_usd, s.total_uzs
before, t1.stock_pieces()
```

## 8. Not enough stock -> everything rolls back

```python
count_before = Sale.objects.count()
create_sale(user=admin, warehouse=wh, exchange_rate=Decimal("12650"),
            items=[{"tile": t1, "quantity": 99999, "unit": "piece"}])   # ValidationError
Sale.objects.count() == count_before      # True: transaction.atomic undid the Sale row
```

## 9. Returns

```python
create_return(user=admin, sale=s, reason="Customer changed his mind",
              items=[{"sale_item": s.items.first(), "quantity_pieces": 4}])
t1.stock_pieces()
s.items.first().returned_pieces
```

## 10. on_delete in action

```python
from django.db.models import ProtectedError
Supplier.objects.first().delete()     # ProtectedError: tiles still reference it
s.delete()                            # PermissionError: sales are permanent
Sale.objects.all().delete()           # PermissionError: the bulk path is blocked too

soft_delete_sale(user=admin, sale=s, reason="Entered by mistake")
Sale.objects.alive().count(), Sale.objects.deleted().count()
t1.stock_pieces()                     # stock came back through a reversing movement
```

## 11. Aggregation over a relation

```python
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Coalesce

Tile.objects.annotate(stock=Coalesce(Sum("movements__quantity_pieces"), 0)
                      ).values("code", "stock")

SaleItem.objects.values("tile__code").annotate(revenue=Sum("line_total_usd")
                                               ).order_by("-revenue")
```
