# Ipak Yoli Ceramica — Frontend и подключение к Django

Готовая React-панель управления для учебного проекта учёта керамической плитки. Интерфейс ориентирован на внутреннюю работу компании: каталог SKU, остатки, движение товара, поставки, продажи и Excel-отчёт.

## Что входит

- Адаптивный интерфейс на React + Vite: desktop, tablet и mobile.
- Страницы: обзор, каталог плитки, склад/остатки, поставки, продажи, отчёты.
- Поиск по текущей странице, фильтры каталога и статусов поставок.
- Форма продажи с несколькими товарными строками, единицами измерения (коробка/штука/м²), скидкой, складом, покупателем и курсом USD → UZS.
- Форма новой поставки и действие «Принять».
- Экспорт Excel через существующий Django-маршрут `/reports/sales.xlsx`.
- Демо-режим: можно осмотреть UI и проверить формы до подключения API. Демо-изменения остаются только в памяти браузера и не попадают в SQLite.
- Пакет `backend_integration/` содержит JSON API для текущих моделей Django. В API используются существующие бизнес-сервисы `sales.services.create_sale` и `inventory.services.receive_shipment`, поэтому остаток не меняется напрямую из браузера.

## Важно о текущем backend

В опубликованном репозитории URL-конфигурация Django пока содержит `/admin/`, главную переадресацию на админку и `/reports/sales.xlsx`; REST/JSON-маршруты `/api/...` в ней не объявлены. Это значит, что React не сможет прочитать реальные данные, пока вы не добавите интеграционный API из папки `backend_integration/`.

Интерфейс учитывает существующую структуру моделей: `catalog.Tile`, `catalog.Supplier`, `catalog.Warehouse`, `inventory.Shipment`, `inventory.ShipmentItem`, `inventory.StockMovement`, `sales.Customer`, `sales.Sale` и `sales.SaleItem`.

---

# Часть 1. Установка Frontend на Windows

## Шаг 1. Установите необходимые программы

Нужны:

1. Python и уже работающий Django backend проекта.
2. Node.js LTS и npm. После установки перезапустите VS Code/терминал.
3. Git — если хотите загружать изменения на GitHub.

Проверьте Node.js и npm в терминале PowerShell:

```powershell
node -v
npm -v
```

Проверьте Python:

```powershell
python --version
```

## Шаг 2. Распакуйте frontend

Рекомендуемая структура репозитория:

```text
IpakYoliCeramica/
├── tiles_project/              # существующий Django backend
│   ├── manage.py
│   ├── config/
│   ├── catalog/
│   ├── inventory/
│   └── sales/
└── frontend/                   # этот пакет
    ├── src/
    ├── backend_integration/
    ├── package.json
    └── vite.config.js
```

Скачайте архив `IpakYoliCeramica-frontend.zip` и распакуйте содержимое папки пакета в новую папку `frontend` в корне репозитория. Не помещайте React-файлы внутрь Django-папок `catalog`, `inventory` или `sales`.

Если GitHub-репозиторий уже склонирован, например, в `C:\Projects\IpakYoliCeramica`, то frontend должен лежать здесь:

```text
C:\Projects\IpakYoliCeramica\frontend
```

## Шаг 3. Установите frontend-зависимости

Откройте новый терминал VS Code и выполните:

```powershell
cd C:\Projects\IpakYoliCeramica\frontend
npm install
```

(Замените путь на путь к вашей папке.)

Файл `.env.example` можно скопировать в `.env`, но для локальной разработки оставьте `VITE_API_BASE_URL` пустым. Запросы `/api`, `/reports` и `/media` автоматически перенаправляются Vite на Django `http://127.0.0.1:8000` через `vite.config.js`.

Пока не запускайте frontend как единственное приложение: для входа и реальных данных сначала нужно включить API в Django. До этого нажмите «Открыть демо-режим» на экране входа.

---

# Часть 2. Подключите API к существующему Django backend

## Шаг 1. Скопируйте два API-файла

Из папки frontend скопируйте:

```text
frontend/backend_integration/api_views.py
frontend/backend_integration/api_urls.py
```

в папку backend:

```text
tiles_project/config/api_views.py
tiles_project/config/api_urls.py
```

То есть названия файлов после копирования должны быть `api_views.py` и `api_urls.py`, а не `api_views.py.txt`. В VS Code они должны находиться рядом с `settings.py` и `urls.py`.

**Почему нужны эти файлы:** `api_views.py` преобразует модели Django в JSON для React. При создании продажи вызывает существующий `create_sale(...)`, а при приёмке поставки — `receive_shipment(...)`. Эти сервисы должны оставаться единственным местом, где меняются складские остатки.

## Шаг 2. Подключите маршруты в `config/urls.py`

Откройте `tiles_project/config/urls.py`. В импорте Django URL-функций добавьте `include`:

```python
from django.urls import include, path
```

Сохраните существующие маршруты и добавьте строку `api/` в `urlpatterns`. Пример итогового файла:

```python
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from sales.reports import sales_report_xlsx

urlpatterns = [
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
    path("admin/", admin.site.urls),
    path("reports/sales.xlsx", sales_report_xlsx, name="sales-report"),
    path("api/", include("config.api_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

Не удаляйте `admin/` и `reports/sales.xlsx`: frontend использует обе существующие возможности.

## Шаг 3. Разрешите локальный Origin для CSRF

В `tiles_project/config/settings.py` добавьте в конец файла:

```python
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
```

Это нужно, потому что форма входа и формы изменения данных отправляют `POST` из браузера. API получает CSRF-cookie через `/api/csrf/`, затем React передаёт токен в заголовке `X-CSRFToken`.

**Не отключайте `CsrfViewMiddleware` и не добавляйте `@csrf_exempt` на все POST-запросы.** Настройка выше предназначена для локальной разработки. Для production разрешайте только фактические frontend-origin и используйте HTTPS.

## Шаг 4. Запустите backend

В терминале PowerShell перейдите в папку Django (там, где лежит `manage.py`):

```powershell
cd C:\Projects\IpakYoliCeramica\tiles_project
```

Если виртуальное окружение ещё не создано:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Если PowerShell не разрешает активацию скрипта, можно запустить backend так:

```powershell
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Примените миграции и при необходимости загрузите демонстрационные записи:

```powershell
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

`seed_demo` в данном учебном проекте создаёт пользователя `admin` с паролем `admin12345`. Эти реквизиты годятся только для локального запуска учебной базы. Не используйте их в production. Если вы не хотите создавать демонстрационные данные, пропустите `seed_demo` и создайте пользователя командой `python manage.py createsuperuser`.

Откройте `http://127.0.0.1:8000/admin/` и убедитесь, что Django Admin доступен. Оставьте этот терминал работать.

## Шаг 5. Запустите frontend во втором терминале

Откройте второй терминал PowerShell:

```powershell
cd C:\Projects\IpakYoliCeramica\frontend
npm run dev
```

Перейдите по адресу:

```text
http://127.0.0.1:5173
```

В форме входа используйте Django-пользователя. Для локальной тестовой базы после `seed_demo` это `admin` / `admin12345`. Если API пока не подключён, используйте «Открыть демо-режим» — он не проверяет логин и не меняет базу данных.

---

# Часть 3. Какие маршруты API добавляются

Все маршруты находятся под префиксом `/api/`. Для чтения данных нужен вход в Django, а браузер использует session-cookie и CSRF.

| Метод | URL | Назначение |
|---|---|---|
| GET | `/api/csrf/` | Получить CSRF-cookie перед POST |
| GET | `/api/auth/me/` | Проверить текущую сессию |
| POST | `/api/auth/login/` | Войти: `{"username":"admin","password":"…"}` |
| POST | `/api/auth/logout/` | Выйти и завершить Django-сессию |
| GET | `/api/dashboard/` | KPI, выручка за 7 дней, последние продажи и движения |
| GET | `/api/tiles/` | Каталог плитки со складским остатком |
| GET | `/api/suppliers/` | Справочник поставщиков |
| GET | `/api/warehouses/` | Справочник складов |
| GET | `/api/customers/` | Справочник покупателей |
| GET | `/api/stock-movements/` | Журнал движений (последние 100) |
| GET | `/api/sales/` | История действующих продаж |
| POST | `/api/sales/` | Провести новую продажу |
| GET | `/api/shipments/` | Список поставок |
| POST | `/api/shipments/` | Создать заказ поставщику |
| POST | `/api/shipments/<id>/receive/` | Принять поставку на склад |

## Формат новой продажи

Frontend отправляет объект такого вида (числа ниже условные):

```json
{
  "warehouse_code": "MAIN",
  "exchange_rate": 12600,
  "customer_id": 2,
  "items": [
    { "tile_id": 1, "quantity": 4, "unit": "box", "discount_pct": 5 },
    { "tile_id": 3, "quantity": 20, "unit": "piece", "discount_pct": 0 },
    { "tile_id": 4, "quantity": 12.5, "unit": "m2", "discount_pct": 2 }
  ]
}
```

`customer_id` может быть `null` для розничного покупателя. Допустимые `unit`: `box`, `piece`, `m2`. Для коробок и штук количество должно быть целым, для м² допускается дробная часть. Сервер повторно проверяет активность товара и остаток. Если количества не хватает, `create_sale` откатывает всю транзакцию — частичное списание не выполняется.

## Формат новой поставки

```json
{
  "supplier_id": 1,
  "warehouse_code": "MAIN",
  "arrival_date": "2026-10-24",
  "shipping_cost_usd": 850,
  "customs_cost_usd": 1200,
  "notes": "Контейнер с настенной и напольной плиткой",
  "items": [
    {
      "tile_id": 1,
      "quantity_pieces": 120,
      "purchase_price_usd_per_m2": 7.15,
      "batch_code": "LOT-26-10-A"
    }
  ]
}
```

При создании поставки остаток ещё не увеличивается. Когда контейнер физически принят, действие «Принять» вызывает `/api/shipments/<id>/receive/`. Django-сервис рассчитывает распределённую себестоимость логистики/таможни и создаёт приходное движение склада. Повторная приёмка отклоняется.

---

# Часть 4. Как устроена связь Frontend ↔ Backend

1. React вызывает `src/api/client.js`; компоненты не обращаются к адресам Django напрямую.
2. `vite.config.js` перенаправляет локальные запросы `/api/*`, `/reports/*` и `/media/*` на `127.0.0.1:8000`.
3. Django проверяет сессию. Для POST также проверяется CSRF-токен.
4. Django сериализует модели в JSON. Деньги, курс и вычисленные значения передаются в форме чисел; даты — ISO-строки.
5. Для продажи и приёмки Django использует существующие функции бизнес-логики и транзакции. Frontend не редактирует количество в базе самостоятельно.
6. После успешного POST React повторно запрашивает данные, чтобы отобразить остатки/продажи с сервера.

Демо-режим и рабочий режим различаются только источником данных. Не используйте числа в демо-режиме для финансовых или складских решений: это демонстрационные записи.

---

# Часть 5. Проверка интеграции

После запуска backend и frontend выполните проверки:

1. Откройте `http://127.0.0.1:8000/api/csrf/`. Должен вернуться JSON примерно `{"ok":true}`.
2. Войдите через frontend. Если пароль верный, откроется рабочая панель, и исчезнет баннер демо-режима.
3. На странице «Каталог плитки» убедитесь, что коды и размеры совпадают с `Django Admin → Catalog → Tiles`.
4. Создайте тестовую поставку со статусом «Заказана». Она не должна немедленно увеличить складской остаток.
5. Откройте «Поставки» и нажмите «Принять». После этого в `Django Admin → Inventory → Stock movements` появятся входящие движения, а остаток плитки увеличится.
6. Создайте продажу на заведомо доступное количество. В списке продаж появится новая операция, а складской остаток уменьшится.
7. Попробуйте провести продажу сверх доступного остатка: сервер должен вернуть понятную ошибку, а остаток не должен измениться.
8. Откройте «Отчёты» и скачайте Excel. Файл создаёт существующий Django URL `/reports/sales.xlsx`.
9. Запустите тесты backend:

```powershell
python manage.py test
```

## Если что-то не работает

### Ошибка 404 на `/api/...`

Проверьте, что оба API-файла лежат в `tiles_project/config/`, а в `config/urls.py` есть строка:

```python
path("api/", include("config.api_urls")),
```

После правок перезапустите `runserver`.

### Ошибка 403 CSRF

Проверьте `CSRF_TRUSTED_ORIGINS`, используйте один и тот же адрес фронтенда (`127.0.0.1` не смешивайте с `localhost` в одной сессии), перезапустите Django и обновите страницу. Не отключайте CSRF-проверку.

### Ошибка 401 или «Не выполнен вход»

Войдите в frontend заново. Проверьте пароль Django-пользователя и убедитесь, что POST login возвращает JSON с полем `user`. Демо-режим не является настоящей авторизацией.

### Каталог отображается, но продажи или поставки не сохраняются

Посмотрите текст ошибки в модальном окне и терминал, где работает Django. Проверьте наличие склада `MAIN`, покупателя/поставщика и товара в базе. В текущем API уже существующий сервис продажи отвечает за ограничения остатков.

### Изображения плитки не отображаются

API возвращает `image_url` для главного `TileImage` (если он задан). При локальном запуске Vite проксирует `/media/` на Django. Если изображения не добавлены через Django Admin, карточки используют графические образцы без фотографий.

---

# Часть 6. Production и безопасность

Текущая конфигурация в репозитории предназначена для учебного локального запуска. Перед публикацией в интернете:

- замените опубликованный `SECRET_KEY`, загрузите секрет из переменных окружения;
- установите `DEBUG = False` и конкретный `ALLOWED_HOSTS`;
- не используйте `admin/admin12345`; создайте отдельного пользователя, задайте сложный пароль и настройте роли;
- включите HTTPS, настройте secure session/CSRF cookies и `CSRF_TRUSTED_ORIGINS` под фактический домен;
- отдавайте frontend и `/api/`, `/admin/`, `/reports/`, `/media/` через один домен с reverse proxy. Так браузеру не понадобится открывать широкий CORS-доступ;
- добавьте авторизацию по ролям: в шаблоне сейчас любой вошедший сотрудник видит пункты навигации, а правила доступа должны также строго проверяться сервером;
- обновляйте зависимости и проверяйте `npm run build` перед публикацией.

Панель не заменяет Django Admin для настройки справочников. Создание товара, поставщика, склада или покупателя пока выполняется через Django Admin. Через frontend можно просматривать каталог, создавать продажи и поставки, а также принимать поставки.

## Полезные команды

```powershell
# frontend: режим разработки
npm run dev

# frontend: production build
npm run build

# preview готовой сборки
npm run preview
```
