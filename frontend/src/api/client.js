const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function cookie(name) {
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.split('=').slice(1).join('=')) : '';
}

export async function ensureCsrfCookie() {
  try {
    await fetch(`${API_BASE}/api/csrf/`, { credentials: 'include' });
  } catch {
    // Demo mode can be used without a running Django server.
  }
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = cookie('csrftoken');
    if (csrf) headers.set('X-CSRFToken', csrf);
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });
  } catch {
    const error = new Error('Не удалось подключиться к Django API. Проверьте, запущен ли backend на порту 8000.');
    error.status = 0;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  let payload;
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => ({}));
  } else {
    payload = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload
      ? (payload.error || payload.detail || payload.message || `Ошибка запроса (${response.status})`)
      : `Сервер вернул HTTP ${response.status}. Проверьте URL API и настройки Django.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const api = {
  csrf: ensureCsrfCookie,
  me: () => apiRequest('/api/auth/me/'),
  login: async (credentials) => {
    await ensureCsrfCookie();
    return apiRequest('/api/auth/login/', { method: 'POST', body: JSON.stringify(credentials) });
  },
  logout: () => apiRequest('/api/auth/logout/', { method: 'POST', body: '{}' }),
  dashboard: () => apiRequest('/api/dashboard/'),
  tiles: () => apiRequest('/api/tiles/'),
  suppliers: () => apiRequest('/api/suppliers/'),
  warehouses: () => apiRequest('/api/warehouses/'),
  customers: () => apiRequest('/api/customers/'),
  shipments: () => apiRequest('/api/shipments/'),
  sales: () => apiRequest('/api/sales/'),
  movements: () => apiRequest('/api/stock-movements/'),
  createSale: (payload) => apiRequest('/api/sales/', { method: 'POST', body: JSON.stringify(payload) }),
  createShipment: (payload) => apiRequest('/api/shipments/', { method: 'POST', body: JSON.stringify(payload) }),
  receiveShipment: (id) => apiRequest(`/api/shipments/${id}/receive/`, { method: 'POST', body: '{}' })
};
