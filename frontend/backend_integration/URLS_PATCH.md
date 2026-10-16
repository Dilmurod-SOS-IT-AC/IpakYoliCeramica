# Минимальные изменения urls.py/settings.py

## `tiles_project/config/urls.py`
Добавьте `include` к импорту:

```python
from django.urls import include, path
```

И добавьте маршрут в существующий `urlpatterns`:

```python
path("api/", include("config.api_urls")),
```

Оставьте существующие `/admin/` и `/reports/sales.xlsx`.

## `tiles_project/config/settings.py`
Добавьте для локальной разработки:

```python
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
```

В production замените эти origin на реальные HTTPS-домены. Не отключайте CSRF.
