"""JSON API endpoints for the Ipak Yoli Ceramica React dashboard.

Copy this file into tiles_project/config/api_views.py.
The API deliberately reuses sales.services.create_sale and
inventory.services.receive_shipment so stock/business rules stay on the server.
"""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
import json
from functools import wraps

from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from catalog.models import Supplier, Tile, Warehouse
from inventory.models import Shipment, ShipmentItem, StockMovement
from inventory.services import receive_shipment
from sales.models import Customer, Sale
from sales.services import create_sale, next_number


def _body(request):
    try:
        value = json.loads(request.body.decode("utf-8") or "{}")
        return value if isinstance(value, dict) else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


def _error(message, status=400):
    return JsonResponse({"error": str(message)}, status=status)


def _api_login_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return _error("Требуется авторизация. Войдите в систему повторно.", 401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _user_payload(user):
    profile = getattr(user, "profile", None)
    role = getattr(profile, "role", "admin" if user.is_superuser else "seller")
    return {"id": user.pk, "username": user.get_username(), "first_name": user.first_name, "last_name": user.last_name, "role": role}


def _serialize_tile(tile, request=None):
    stock_value = getattr(tile, "_stock_total", None)
    stock = int(stock_value if stock_value is not None else tile.stock_pieces())
    main_image = tile.images.filter(is_main=True).first()
    image_url = None
    if main_image and main_image.image:
        image_url = main_image.image.url
        if request:
            image_url = request.build_absolute_uri(image_url)
    piece_area = Decimal(tile.width_mm * tile.height_mm) / Decimal("1000000")
    return {
        "id": tile.pk,
        "code": tile.code,
        "supplier_id": tile.supplier_id,
        "supplier_name": tile.supplier.name,
        "width_mm": tile.width_mm,
        "height_mm": tile.height_mm,
        "size_label": tile.size_label,
        "pieces_per_box": tile.pieces_per_box,
        "m2_per_piece": float(piece_area),
        "m2_per_box": float(tile.m2_per_box),
        "price_usd_per_m2": float(tile.price_usd_per_m2),
        "min_stock_pieces": tile.min_stock_pieces,
        "stock_pieces": stock,
        "stock_m2": round(float(piece_area * stock), 3),
        "is_active": tile.is_active,
        "image_url": image_url,
        "created_at": tile.created_at.isoformat() if tile.created_at else None,
    }


def _serialize_movement(row):
    return {
        "id": row.pk,
        "type": row.type,
        "tile_id": row.tile_id,
        "tile_code": row.tile.code,
        "warehouse_code": row.warehouse_id,
        "quantity_pieces": row.quantity_pieces,
        "note": row.note,
        "created_by_name": row.created_by.get_username(),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _serialize_sale(sale):
    items = []
    for item in sale.items.select_related("tile").all():
        items.append({
            "id": item.pk,
            "tile_id": item.tile_id,
            "tile_code": item.tile.code,
            "quantity_pieces": item.quantity_pieces,
            "price_usd_per_m2": float(item.price_usd_per_m2),
            "discount_pct": float(item.discount_pct),
            "line_total_usd": float(item.line_total_usd),
            "m2": float(item.m2),
        })
    return {
        "id": sale.pk,
        "number": sale.number,
        "customer_id": sale.customer_id,
        "customer_name": sale.customer.name if sale.customer else "Розничный покупатель",
        "warehouse_code": sale.warehouse_id,
        "exchange_rate": float(sale.exchange_rate),
        "total_usd": float(sale.total_usd),
        "total_uzs": float(sale.total_uzs),
        "items_count": len(items),
        "items": items,
        "created_by_name": sale.created_by.get_username(),
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
    }


def _serialize_shipment(shipment):
    items = list(shipment.items.select_related("tile").all())
    return {
        "id": shipment.pk,
        "number": shipment.number,
        "supplier_id": shipment.supplier_id,
        "supplier_name": shipment.supplier.name,
        "warehouse_code": shipment.warehouse_id,
        "status": shipment.status,
        "arrival_date": shipment.arrival_date.isoformat() if shipment.arrival_date else None,
        "shipping_cost_usd": float(shipment.shipping_cost_usd),
        "customs_cost_usd": float(shipment.customs_cost_usd),
        "exchange_rate": float(shipment.exchange_rate) if shipment.exchange_rate is not None else None,
        "notes": shipment.notes,
        "items_count": len(items),
        "items": [{
            "id": item.pk,
            "tile_id": item.tile_id,
            "tile_code": item.tile.code,
            "batch_code": item.batch_code,
            "quantity_pieces": item.quantity_pieces,
            "purchase_price_usd_per_m2": float(item.purchase_price_usd_per_m2),
            "landed_cost_usd_per_m2": float(item.landed_cost_usd_per_m2) if item.landed_cost_usd_per_m2 is not None else None,
        } for item in items],
        "created_by_name": shipment.created_by.get_username(),
        "created_at": shipment.created_at.isoformat() if shipment.created_at else None,
    }


@ensure_csrf_cookie
@require_GET
def csrf_cookie(request):
    return JsonResponse({"ok": True})


@require_GET
def auth_me(request):
    if not request.user.is_authenticated:
        return _error("Не выполнен вход.", 401)
    return JsonResponse({"user": _user_payload(request.user)})


@require_POST
def auth_login(request):
    payload = _body(request)
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not username or not password:
        return _error("Введите имя пользователя и пароль.", 400)
    user = authenticate(request, username=username, password=password)
    if user is None:
        return _error("Неверное имя пользователя или пароль.", 401)
    if not user.is_active:
        return _error("Учётная запись отключена.", 403)
    login(request, user)
    return JsonResponse({"user": _user_payload(user)})


@require_POST
def auth_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


@_api_login_required
@require_GET
def dashboard(request):
    today = timezone.localdate()
    first_month_day = today.replace(day=1)
    first_week_day = today - timedelta(days=6)

    tiles = list(Tile.objects.filter(is_active=True).select_related("supplier").annotate(
        _stock_total=Coalesce(Sum("movements__quantity_pieces"), 0)
    ))
    total_pieces = sum(int(tile._stock_total) for tile in tiles)
    low_stock_count = sum(1 for tile in tiles if int(tile._stock_total) <= tile.min_stock_pieces)
    live_sales = list(Sale.objects.alive().select_related("customer", "warehouse", "created_by").order_by("-created_at")[:1000])
    month_sales = [sale for sale in live_sales if timezone.localtime(sale.created_at).date() >= first_month_day]
    week_sales = [sale for sale in live_sales if timezone.localtime(sale.created_at).date() >= first_week_day]
    by_day = {first_week_day + timedelta(days=i): Decimal("0") for i in range(7)}
    for sale in week_sales:
        day = timezone.localtime(sale.created_at).date()
        if day in by_day:
            by_day[day] += sale.total_uzs
    sales_week = [{
        "date": day.isoformat(),
        "label": ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][day.weekday()],
        "total_uzs": float(total),
    } for day, total in by_day.items()]

    recent_movements = StockMovement.objects.select_related("tile", "warehouse", "created_by").order_by("-created_at")[:8]
    return JsonResponse({
        "kpis": {
            "tile_count": len(tiles),
            "total_pieces": total_pieces,
            "low_stock_count": low_stock_count,
            "month_sales_count": len(month_sales),
            "month_revenue_uzs": float(sum((sale.total_uzs for sale in month_sales), Decimal("0"))),
            "shipments_in_transit": Shipment.objects.filter(status=Shipment.Status.IN_TRANSIT).count(),
            "suppliers_count": Supplier.objects.count(),
        },
        "sales_week": sales_week,
        "recent_sales": [_serialize_sale(sale) for sale in live_sales[:5]],
        "recent_movements": [_serialize_movement(item) for item in recent_movements],
    })


@_api_login_required
@require_GET
def tiles_list(request):
    queryset = Tile.objects.select_related("supplier").prefetch_related("images").annotate(
        _stock_total=Coalesce(Sum("movements__quantity_pieces"), 0)
    ).order_by("code")
    if request.GET.get("active") == "1":
        queryset = queryset.filter(is_active=True)
    return JsonResponse([_serialize_tile(tile, request) for tile in queryset], safe=False)


@_api_login_required
@require_GET
def suppliers_list(request):
    return JsonResponse([{"id": s.pk, "name": s.name, "country": s.country} for s in Supplier.objects.order_by("name")], safe=False)


@_api_login_required
@require_GET
def warehouses_list(request):
    return JsonResponse([{"code": w.code, "name": w.name} for w in Warehouse.objects.order_by("code")], safe=False)


@_api_login_required
@require_GET
def customers_list(request):
    return JsonResponse([{"id": c.pk, "name": c.name, "type": c.type, "phone": c.phone} for c in Customer.objects.order_by("name")], safe=False)


@_api_login_required
@require_GET
def stock_movements_list(request):
    queryset = StockMovement.objects.select_related("tile", "warehouse", "created_by").order_by("-created_at")[:100]
    return JsonResponse([_serialize_movement(row) for row in queryset], safe=False)


@_api_login_required
@require_http_methods(["GET", "POST"])
def sales_list_create(request):
    if request.method == "GET":
        queryset = Sale.objects.alive().select_related("customer", "warehouse", "created_by").order_by("-created_at")[:200]
        return JsonResponse([_serialize_sale(sale) for sale in queryset], safe=False)

    payload = _body(request)
    try:
        warehouse = Warehouse.objects.get(pk=str(payload.get("warehouse_code", "MAIN")))
        exchange_rate = Decimal(str(payload.get("exchange_rate", "")))
        if exchange_rate <= 0:
            return _error("Курс обмена должен быть больше нуля.")
        customer = None
        if payload.get("customer_id") not in (None, ""):
            customer = Customer.objects.get(pk=int(payload["customer_id"]))
        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            return _error("Добавьте хотя бы одну товарную позицию.")
        items = []
        for row in raw_items:
            tile = Tile.objects.get(pk=int(row["tile_id"]), is_active=True)
            quantity = Decimal(str(row.get("quantity", "")))
            if quantity <= 0:
                return _error(f"Количество для {tile.code} должно быть больше нуля.")
            discount = Decimal(str(row.get("discount_pct", 0)))
            if discount < 0 or discount > 100:
                return _error("Скидка должна быть в диапазоне от 0 до 100%.")
            unit = row.get("unit", "piece")
            if unit in ("piece", "box") and quantity != quantity.to_integral_value():
                return _error(f"Количество для единиц «шт.» и «коробка» должно быть целым числом ({tile.code}).")
            items.append({"tile": tile, "quantity": quantity, "unit": unit, "discount_pct": discount})
        sale = create_sale(user=request.user, warehouse=warehouse, exchange_rate=exchange_rate, items=items, customer=customer)
        return JsonResponse(_serialize_sale(sale), status=201)
    except Warehouse.DoesNotExist:
        return _error("Указанный склад не найден.")
    except Customer.DoesNotExist:
        return _error("Указанный покупатель не найден.")
    except Tile.DoesNotExist:
        return _error("Одна из товарных позиций не найдена или неактивна.")
    except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
        return _error(f"Некорректные данные продажи: {exc}")
    except ValidationError as exc:
        return _error(" ".join(exc.messages))
    except PermissionDenied as exc:
        return _error(exc, 403)


@_api_login_required
@require_http_methods(["GET", "POST"])
def shipments_list_create(request):
    if request.method == "GET":
        queryset = Shipment.objects.select_related("supplier", "warehouse", "created_by").prefetch_related("items__tile").order_by("-created_at")[:200]
        return JsonResponse([_serialize_shipment(shipment) for shipment in queryset], safe=False)

    payload = _body(request)
    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        return _error("Добавьте хотя бы одну позицию в поставку.")
    try:
        supplier = Supplier.objects.get(pk=int(payload["supplier_id"]))
        warehouse = Warehouse.objects.get(pk=str(payload.get("warehouse_code", "MAIN")))
        status = payload.get("status", Shipment.Status.ORDERED)
        if status not in (Shipment.Status.ORDERED, Shipment.Status.IN_TRANSIT):
            return _error("Новая поставка может иметь статус «заказана» или «в пути». Для оприходования используйте отдельную операцию приёмки.")
        shipment = Shipment(
            number=str(payload.get("number") or next_number("SH")),
            supplier=supplier,
            warehouse=warehouse,
            status=status,
            arrival_date=payload.get("arrival_date") or None,
            shipping_cost_usd=Decimal(str(payload.get("shipping_cost_usd", 0))),
            customs_cost_usd=Decimal(str(payload.get("customs_cost_usd", 0))),
            exchange_rate=Decimal(str(payload["exchange_rate"])) if payload.get("exchange_rate") not in (None, "") else None,
            notes=str(payload.get("notes", "")),
            created_by=request.user,
        )
        if shipment.shipping_cost_usd < 0 or shipment.customs_cost_usd < 0:
            return _error("Дополнительные расходы не могут быть отрицательными.")
        with transaction.atomic():
            shipment.save()
            for row in raw_items:
                tile = Tile.objects.get(pk=int(row["tile_id"]))
                quantity = int(row["quantity_pieces"])
                price = Decimal(str(row["purchase_price_usd_per_m2"]))
                if quantity <= 0 or price <= 0:
                    raise ValueError("Количество и закупочная цена должны быть больше нуля.")
                ShipmentItem.objects.create(
                    shipment=shipment,
                    tile=tile,
                    batch_code=str(row.get("batch_code", "")),
                    quantity_pieces=quantity,
                    purchase_price_usd_per_m2=price,
                )
        return JsonResponse(_serialize_shipment(shipment), status=201)
    except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
        return _error(f"Некорректные данные поставки: {exc}")
    except (Supplier.DoesNotExist, Warehouse.DoesNotExist, Tile.DoesNotExist):
        return _error("Поставщик, склад или товар не найдены.")
    except ValidationError as exc:
        return _error(" ".join(exc.messages))


@_api_login_required
@require_POST
def receive_shipment_view(request, shipment_id):
    try:
        shipment = Shipment.objects.select_related("supplier", "warehouse").get(pk=shipment_id)
        shipment = receive_shipment(shipment=shipment, user=request.user)
        return JsonResponse(_serialize_shipment(shipment))
    except Shipment.DoesNotExist:
        return _error("Поставка не найдена.", 404)
    except (ValidationError, PermissionDenied) as exc:
        messages = " ".join(exc.messages) if isinstance(exc, ValidationError) else str(exc)
        return _error(messages, 403 if isinstance(exc, PermissionDenied) else 400)
