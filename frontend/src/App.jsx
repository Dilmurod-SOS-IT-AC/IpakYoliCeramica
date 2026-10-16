import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn } from 'lucide-react';
import Layout from './components/Layout.jsx';
import { api } from './api/client.js';
import { demoCustomers, demoDashboard, demoMovements, demoSales, demoShipments, demoSuppliers, demoTiles, demoWarehouses } from './data/demo.js';
import DashboardPage from './pages/DashboardPage.jsx';
import TilesPage from './pages/TilesPage.jsx';
import StockPage from './pages/StockPage.jsx';
import ShipmentsPage from './pages/ShipmentsPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import { DJANGO_BASE_URL } from './config.js';

const demoData = () => ({
  dashboard: structuredClone(demoDashboard), tiles: structuredClone(demoTiles), suppliers: structuredClone(demoSuppliers),
  warehouses: structuredClone(demoWarehouses), customers: structuredClone(demoCustomers), shipments: structuredClone(demoShipments),
  sales: structuredClone(demoSales), movements: structuredClone(demoMovements)
});
const listValue = (value) => Array.isArray(value) ? value : (Array.isArray(value?.results) ? value.results : []);

export default function App() {
    const location = useLocation();

    useEffect(() => {
        if (location.pathname !== '/stock') {
            window.location.replace(
                `${DJANGO_BASE_URL}/admin/`
            );
        }
    }, [location.pathname]);

    if (location.pathname !== '/stock') {
        return (
            <div className="boot-screen">
                Открываем интерфейс Django...
            </div>
        );
    }

    return <InventoryApp />;
}

function InventoryApp() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState(demoData);
  const [globalQuery, setGlobalQuery] = useState('');
  const [apiIssue, setApiIssue] = useState('');
  const [toast, setToast] = useState(null);
  const [newSaleRequest, setNewSaleRequest] = useState(0);

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind, id: Date.now() });
  }, []);

  useEffect(() => {
    let alive = true;
    const storedDemo = localStorage.getItem('ipak-demo-mode') === '1';
    if (storedDemo) {
      setAuth({ username: 'demo', role: 'Демо-пользователь' });
      setDemoMode(true);
      setBooting(false);
      return () => { alive = false; };
    }
    api.csrf();
    api.me().then((result) => {
      if (!alive) return;
      setAuth(result.user || result);
      setDemoMode(false);
    }).catch(() => {
      // Not signed in or the API integration hasn't been installed yet.
      // The user may still open the local demo dashboard from the sign-in screen.
    }).finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, []);



  const loadLiveData = useCallback(async () => {
    if (!auth || demoMode) return;

    const [tiles, warehouses, movements] =
        await Promise.allSettled([
            api.tiles(),
            api.warehouses(),
            api.movements()
        ]);

    const results = [tiles, warehouses, movements];
    const failed = results.filter(
        (item) => item.status === 'rejected'
    );

    setData((previous) => ({
        ...previous,

        tiles: tiles.status === 'fulfilled'
            ? listValue(tiles.value)
            : previous.tiles,

        warehouses: warehouses.status === 'fulfilled'
            ? listValue(warehouses.value)
            : previous.warehouses,

        movements: movements.status === 'fulfilled'
            ? listValue(movements.value)
            : previous.movements
    }));

    if (failed.length > 0) {
        const error = failed[0].reason;

        setApiIssue(
            `Не удалось загрузить данные склада: ${
                error?.message || 'ошибка API'
            }`
        );
    } else {
        setApiIssue('');
    }
}, [auth, demoMode]);

  useEffect(() => { if (auth && !demoMode) loadLiveData(); }, [auth, demoMode, loadLiveData]);

  async function enterDemo() {
    setData(demoData());
    setDemoMode(true);
    setAuth({ username: 'demo', role: 'Демо-пользователь' });
    setApiIssue('');
    localStorage.setItem('ipak-demo-mode', '1');
    navigate('/stock', { replace: true });
  }

  async function handleLogin(credentials) {
    const result = await api.login(credentials);
    setAuth(result.user || result);
    setDemoMode(false);
    localStorage.removeItem('ipak-demo-mode');
    setApiIssue('');
    navigate('/stock', { replace: true });
  }

  async function handleLogout() {
    if (!demoMode) {
      try { await api.logout(); } catch { /* Always clear the local view. */ }
    }
    localStorage.removeItem('ipak-demo-mode');
    setAuth(null);
    setDemoMode(false);
    setApiIssue('');
    setData(demoData());
    navigate('/stock', { replace: true });
  }

  async function createSale(payload) {
    if (demoMode) {
      const now = new Date();
      const totalUsd = payload.items.reduce((sum, line) => {
        const tile = data.tiles.find((item) => String(item.id) === String(line.tile_id));
        if (!tile) return sum;
        const areaPerPiece = Number(tile.width_mm) * Number(tile.height_mm) / 1_000_000;
        const q = Number(line.quantity || 0);
        const pieces = line.unit === 'box' ? q * Number(tile.pieces_per_box) : line.unit === 'm2' ? Math.ceil(q / areaPerPiece) : q;
        return sum + pieces * areaPerPiece * Number(tile.price_usd_per_m2) * (1 - Number(line.discount_pct || 0) / 100);
      }, 0);
      const customer = data.customers.find((c) => String(c.id) === String(payload.customer_id));
      const newSale = { id: Date.now(), number: `DEMO-${now.getTime().toString().slice(-7)}`, customer_name: customer?.name || 'Розничный покупатель', warehouse_code: payload.warehouse_code, items_count: payload.items.length, total_usd: totalUsd, total_uzs: totalUsd * payload.exchange_rate, created_at: now.toISOString(), created_by_name: 'demo' };
      const changes = payload.items.map((line) => {
        const tile = data.tiles.find((item) => String(item.id) === String(line.tile_id));
        if (!tile) return null;
        const q = Number(line.quantity || 0);
        const pieces = line.unit === 'box' ? q * Number(tile.pieces_per_box) : line.unit === 'm2' ? Math.ceil(q / (Number(tile.width_mm) * Number(tile.height_mm) / 1_000_000)) : q;
        return { tileId: tile.id, pieces, code: tile.code };
      }).filter(Boolean);
      setData((old) => ({ ...old,
        sales: [newSale, ...old.sales],
        tiles: old.tiles.map((tile) => { const change = changes.find((c) => c.tileId === tile.id); if (!change) return tile; const pieces = Math.max(0, Number(tile.stock_pieces || 0) - change.pieces); return { ...tile, stock_pieces: pieces, stock_m2: pieces * Number(tile.width_mm) * Number(tile.height_mm) / 1_000_000 }; }),
        movements: [...changes.map((change, idx) => ({ id: Date.now() + idx, type: 'sale', tile_code: change.code, warehouse_code: payload.warehouse_code, quantity_pieces: -change.pieces, note: `Демо-продажа ${newSale.number}`, created_at: now.toISOString(), created_by_name: 'demo' })), ...old.movements].slice(0, 30),
        dashboard: { ...old.dashboard, kpis: { ...old.dashboard.kpis, month_sales_count: Number(old.dashboard.kpis.month_sales_count || 0) + 1, month_revenue_uzs: Number(old.dashboard.kpis.month_revenue_uzs || 0) + totalUsd * payload.exchange_rate } }
      }));
      notify('Демо-продажа создана. В базе Django ничего не изменилось.');
      return;
    }
    const result = await api.createSale(payload);
    await loadLiveData();
    notify(`Продажа ${result.number || 'успешно'} проведена.`);
  }

  async function createShipment(payload) {
    if (demoMode) {
      const now = new Date();
      const supplier = data.suppliers.find((s) => Number(s.id) === Number(payload.supplier_id));
      const shipment = { id: Date.now(), number: `DEMO-SH-${String(data.shipments.length + 1).padStart(3, '0')}`, supplier_name: supplier?.name || 'Поставщик', warehouse_code: payload.warehouse_code, status: 'ordered', arrival_date: payload.arrival_date, items_count: payload.items.length, shipping_cost_usd: Number(payload.shipping_cost_usd || 0), customs_cost_usd: Number(payload.customs_cost_usd || 0), created_at: now.toISOString(), items: payload.items };
      setData((old) => ({ ...old, shipments: [shipment, ...old.shipments] }));
      notify('Поставка добавлена в демо-список.');
      return;
    }
    const result = await api.createShipment(payload);
    await loadLiveData();
    notify(`Поставка ${result.number || 'создана'}.`);
  }

  async function receiveShipment(id) {
    if (demoMode) {
      const shipment = data.shipments.find((s) => String(s.id) === String(id));
      const items = shipment?.items?.length ? shipment.items : [{ tile_id: data.tiles[0]?.id, tile_code: data.tiles[0]?.code, quantity_pieces: 12 }];
      const now = new Date().toISOString();
      setData((old) => {
        const changes = items.map((item) => ({ ...item, tile_id: Number(item.tile_id) }));
        const tiles = old.tiles.map((tile) => {
          const amount = changes.filter((item) => item.tile_id === Number(tile.id)).reduce((sum, item) => sum + Number(item.quantity_pieces || 0), 0);
          if (!amount) return tile;
          const pieces = Number(tile.stock_pieces || 0) + amount;
          return { ...tile, stock_pieces: pieces, stock_m2: pieces * Number(tile.width_mm) * Number(tile.height_mm) / 1_000_000 };
        });
        const newMovements = changes.map((item, index) => ({ id: Date.now() + index, type: 'incoming', tile_code: item.tile_code || old.tiles.find((tile) => Number(tile.id) === item.tile_id)?.code || 'SKU', warehouse_code: shipment?.warehouse_code || 'MAIN', quantity_pieces: Number(item.quantity_pieces || 0), note: `Демо-приёмка ${shipment?.number || ''}`.trim(), created_at: now, created_by_name: 'demo' }));
        const lowCount = tiles.filter((tile) => Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0)).length;
        return { ...old, tiles, shipments: old.shipments.map((s) => String(s.id) === String(id) ? { ...s, status: 'arrived' } : s), movements: [...newMovements, ...old.movements].slice(0, 50), dashboard: { ...old.dashboard, kpis: { ...old.dashboard.kpis, total_pieces: Number(old.dashboard.kpis.total_pieces || 0) + changes.reduce((sum, item) => sum + Number(item.quantity_pieces || 0), 0), low_stock_count: lowCount } } };
      });
      notify(shipment ? `Поставка ${shipment.number} отмечена как полученная в демо-режиме; демонстрационный остаток обновлён.` : 'Поставка принята в демо-режиме.');
      return;
    }
    await api.receiveShipment(id);
    await loadLiveData();
    notify('Поставка принята. Остатки обновлены сервером.');
  }

  const handleNewSale = useCallback(() => {
    setNewSaleRequest((prev) => prev + 1);
    navigate('/sales');
  }, [navigate]);
  const consumeSaleRequest = useCallback(() => setNewSaleRequest(0), []);

  const page = useMemo(() => {
    if (!auth) return null;

    return (
        <Routes>
            <Route
                path="/stock"
                element={
                    <StockPage
                        data={data}
                        query={globalQuery}
                    />
                }
            />

            <Route
                path="*"
                element={<Navigate to="/stock" replace />}
            />
        </Routes>
    );
}, [auth, data, globalQuery]);

  if (booting) return <div className="boot-screen"><div className="boot-logo">IP</div><LoaderCircle className="spin" size={22} /><span>Подготовка рабочего пространства…</span></div>;
  if (!auth) return <LoginScreen onLogin={handleLogin} onDemo={enterDemo} />;

  return <Layout user={auth} demoMode={demoMode} onLogout={handleLogout} onNewSale={handleNewSale} globalQuery={globalQuery} setGlobalQuery={setGlobalQuery}>
    {apiIssue && !demoMode && <div className="api-warning"><AlertCircle size={18} /><span>{apiIssue}</span><button onClick={loadLiveData}>Повторить запросы <ArrowRight size={14} /></button></div>}
    {page}
    {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}><span className="toast-check">✓</span><div>{toast.message}</div><button onClick={() => setToast(null)} aria-label="Закрыть уведомление">×</button></div>}
  </Layout>;
}

function LoginScreen({ onLogin, onDemo }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try { await onLogin({ username: username.trim(), password }); }
    catch (err) { setError(err.message || 'Не удалось войти. Проверьте логин, пароль и наличие API-маршрутов.'); }
    finally { setLoading(false); }
  }
  return <div className="login-layout">
    <div className="login-art"><div className="login-art-pattern pattern-one" /><div className="login-art-pattern pattern-two" /><div className="login-brand"><div className="brand-symbol"><span>IP</span><i /></div><div className="brand-wordmark"><strong>IPAK YOLI</strong><span>CERAMICA</span></div></div><div className="login-art-copy"><span className="eyebrow">CERAMIC TILES · INVENTORY · SALES</span><h1>Порядок в деталях.<br /><em>Контроль в цифрах.</em></h1><p>Единое пространство для управления ассортиментом плитки, складскими остатками, поставками и продажами.</p><div className="login-art-metrics"><div><strong>360°</strong><span>видимость операций</span></div><div><strong>01</strong><span>единая система учёта</span></div></div></div><div className="login-art-bottom"><span>© 2026 Ipak Yoli Ceramica</span><span>Сделано для точного учёта</span></div><div className="login-decor-tile login-decor-a" /><div className="login-decor-tile login-decor-b" /><div className="login-decor-tile login-decor-c" /></div>
    <div className="login-form-side"><div className="login-mobile-brand"><div className="brand-symbol"><span>IP</span><i /></div><div className="brand-wordmark"><strong>IPAK YOLI</strong><span>CERAMICA</span></div></div><div className="login-form-wrap"><div className="login-eyebrow">РАБОЧАЯ ПАНЕЛЬ</div><h2>С возвращением</h2><p className="login-description">Войдите в систему, чтобы продолжить работу.</p>
      <form onSubmit={submit} className="login-form"><label className="field"><span>Имя пользователя</span><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Введите логин" required /></label><label className="field"><span>Пароль</span><div className="password-field"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
        {error && <div className="login-error"><AlertCircle size={16} />{error}</div>}
        <button type="submit" className="button button-primary login-submit" disabled={loading}>{loading ? <><LoaderCircle size={17} className="spin" /> Проверка данных…</> : <><LogIn size={17} /> Войти в систему</>}</button>
      </form><div className="login-separator"><span>или</span></div><button className="button button-demo" onClick={onDemo}><span className="demo-dot" /> Открыть демо-режим <ArrowRight size={16} /></button><div className="login-footnote"><LockKeyhole size={14} /><span>В рабочем режиме авторизация выполняется через Django и его сессии. Демоданные не записываются в базу.</span></div></div><div className="login-form-footer"><span>Нужна помощь с доступом?</span><a href="https://github.com/Dilmurod-SOS-IT-AC/IpakYoliCeramica" target="_blank" rel="noreferrer">Открыть проект на GitHub ↗</a></div></div>
  </div>;
}
