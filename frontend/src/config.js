export const DJANGO_BASE_URL = (
    import.meta.env.VITE_DJANGO_BASE_URL ||
    'http://127.0.0.1:8000'
).replace(/\/+$/, '');