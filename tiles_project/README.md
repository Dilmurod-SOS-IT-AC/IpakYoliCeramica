# Ceramic Tiles Management System — Django learning project

A small but real warehouse + sales system for a company importing ceramic tiles from China.
The point of the project is to **learn primary keys, foreign keys and relations in Django**
on data that behaves like the real world.

## 1. Install (Windows)

```bat
cd tiles_project
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

macOS / Linux: `python3 -m venv venv` then `source venv/bin/activate`.

## 2. Create the database

```bat
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

`seed_demo` creates demo data and a user: **admin / admin12345**

Open http://127.0.0.1:8000/admin/

If you prefer an empty database, skip `seed_demo` and run
`python manage.py createsuperuser` instead.

## 3. Check that everything works

```bat
python manage.py test
```

10 tests should pass. They are written as lessons: stock changes, rollback on error,
blocked hard deletes, PROTECT, SET_NULL.

## 4. Excel report

While the server is running and you are logged in:

```
http://127.0.0.1:8000/reports/sales.xlsx?from=2026-01-01&to=2026-12-31
```

Two sheets: Sales and Returns.

## 5. Practice in the shell

```bat
python manage.py shell
```

Then copy the blocks from `SHELL_EXERCISES.md` one by one.

---

## Project structure

```
tiles_project/
├── config/          settings.py, urls.py
├── accounts/        Profile          -> OneToOneField
├── catalog/         Supplier, Warehouse, Tile, TileImage
├── inventory/       Shipment, ShipmentItem, StockMovement + services.py
├── sales/           Customer, Sale, SaleItem, SaleReturn, ReturnItem
│                    + services.py, reports.py, tests.py
└── manage.py
```

## What each concept looks like, and where to find it

| Concept | File | Line of code |
|---|---|---|
| Automatic PK (`BigAutoField`) | `catalog/models.py` | `Supplier` has no PK declared |
| Natural (string) PK | `catalog/models.py` | `Warehouse.code = CharField(primary_key=True)` |
| `unique=True` is not a PK | `catalog/models.py` | `Tile.code` |
| `OneToOneField` | `accounts/models.py` | `Profile.user` |
| `ForeignKey` + `related_name` | everywhere | `supplier.tiles.all()` |
| `on_delete=CASCADE` | `catalog/models.py` | `TileImage.tile` |
| `on_delete=PROTECT` | `inventory/models.py` | `StockMovement.tile` |
| `on_delete=SET_NULL` | `sales/models.py` | `Sale.customer` |
| Two FKs to the same model | `sales/models.py` | `Sale.created_by` / `Sale.deleted_by` |
| Nullable FK | `inventory/models.py` | `StockMovement.lot` |
| Cross-app FK as a string | `inventory/models.py` | `"sales.SaleItem"` |
| M2M with `through` | `sales/models.py` | `Sale.tiles` through `SaleItem` |
| `UniqueConstraint` | `inventory/models.py` | `unique_lot_per_shipment` |
| `CheckConstraint` | `catalog/models.py` | `tile_sizes_positive` |
| Custom QuerySet as manager | `inventory/models.py` | `AppendOnlyQuerySet.as_manager()` |
| `transaction.atomic` | `sales/services.py` | `create_sale` |
| `select_for_update` (row lock) | `sales/services.py` | inside `create_sale` |
| `select_related` (no N+1) | `sales/reports.py` | the sale items query |
| `annotate` + `Coalesce(Sum(...))` | `catalog/admin.py` | stock column |

## Business rules built into the code

1. **Stock lives in one place only.** `StockMovement` holds + and - rows; current stock is
   their sum. Nothing ever edits a stock number directly.
2. **One unit is stored, the rest are calculated.** Pieces are stored; boxes and m² come from
   the tile size and `pieces_per_box`, so they can never disagree.
3. **Sales, returns and movements are permanent.** `obj.delete()` and
   `Model.objects.filter(...).delete()` both raise `PermissionError`.
4. **Only an admin can "delete" a sale**, and that is a soft delete: the row stays, and the
   stock is returned by a reversing movement.
5. **Prices and costs are frozen on the sale line**, so old reports never change when today's
   price changes.

## Exercises

1. Add a `Payment` model: required FK to `Customer`, optional FK to `Sale`. Write a query
   showing each customer's debt.
2. Add an `ExchangeRate` model whose PK is the date itself, and make `create_sale` read the
   rate from it.
3. Remove `related_name` from `Sale.deleted_by`, run `makemigrations`, and read the clash error.
4. Try deleting a received `Shipment` and explain the CASCADE -> PROTECT chain that stops it.
5. Check stock **per lot** instead of per tile in `create_sale`.
6. Top 5 tiles by profit, using `annotate` over `sale_items`.
7. Add an `AuditLog` model with a `JSONField` and record every `soft_delete_sale` call.
8. Add a `WriteOff` flow for tiles broken in the warehouse.
