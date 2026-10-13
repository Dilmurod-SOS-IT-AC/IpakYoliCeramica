import { useMemo } from 'react';
import { Activity, ArrowRight, Boxes, CircleDollarSign, PackageCheck, Plus, ShoppingBag, TriangleAlert, Truck, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading, StatCard, StatusPill, TileSwatch } from '../components/ui.jsx';

const money = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

export default function DashboardPage({ data, onNewSale, query = '' }) {
  const navigate = useNavigate();
  const kpis = data.dashboard?.kpis || {};
  const lowStock = useMemo(() => data.tiles.filter((tile) => Number(tile.stock_pieces ?? 0) <= Number(tile.min_stock_pieces ?? 0)).slice(0, 4), [data.tiles]);
  const movements = useMemo(() => data.movements.filter((row) => `${row.tile_code} ${row.note} ${row.type}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [data.movements, query]);
  const weekly = data.dashboard?.sales_week || [];
  const maxBar = Math.max(1, ...weekly.map((d) => Number(d.total_uzs || 0)));
  const recentSales = data.sales.slice(0, 4);

  return <>
    <PageHeading eyebrow={new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()} title="Добро пожаловать 👋" description="Вот что происходит с вашим складом и продажами сегодня."
      action={<button className="button button-primary" onClick={onNewSale}><Plus size={17} /> Новая продажа</button>} />

    <div className="stats-grid">
      <StatCard label="Выручка за месяц" value={`${money(kpis.month_revenue_uzs)} сум`} footnote="за текущий месяц" icon={CircleDollarSign} tone="green" />
      <StatCard label="Продажи за месяц" value={money(kpis.month_sales_count)} footnote="с начала месяца" icon={Activity} tone="blue" />
      <StatCard label="Позиций в каталоге" value={money(kpis.tile_count)} footnote="активных SKU" icon={Boxes} tone="violet" />
      <StatCard label="Низкий остаток" value={money(kpis.low_stock_count)} trendLabel="нужны поставки" icon={TriangleAlert} tone="orange" />
    </div>

    <div className="dashboard-grid">
      <section className="card sales-chart-card">
        <div className="card-heading"><div><span className="section-kicker">АНАЛИТИКА</span><h2>Динамика продаж</h2><p>Выручка за последние 7 дней</p></div><button className="button button-quiet" onClick={() => navigate('/reports')}>Все отчёты <ArrowRight size={15} /></button></div>
        <div className="chart-summary"><strong>{money(weekly.reduce((sum, day) => sum + Number(day.total_uzs || 0), 0))} <small>сум</small></strong><span className="chart-legend"><i /> Выручка, UZS</span></div>
        <div className="bar-chart" role="img" aria-label="Столбчатая диаграмма продаж за семь дней">
          {weekly.map((item) => <div className="bar-column" key={item.date}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(4, Number(item.total_uzs || 0) / maxBar * 100)}%` }} title={`${money(item.total_uzs)} сум`} /></div><span>{item.label}</span></div>)}
        </div>
      </section>
      <section className="card low-stock-card">
        <div className="card-heading"><div><span className="section-kicker">ТРЕБУЕТ ВНИМАНИЯ</span><h2>Заканчивается</h2></div><button className="round-link" onClick={() => navigate('/stock')} aria-label="Перейти к остаткам"><ArrowRight size={17} /></button></div>
        {lowStock.length ? <div className="low-stock-list">{lowStock.map((tile) => <div className="low-stock-item" key={tile.id}><TileSwatch tint={tile.tint || 'stone'} /><div className="low-stock-info"><strong>{tile.code}</strong><span>{tile.size_label || `${tile.width_mm} × ${tile.height_mm}`} мм</span><div className="mini-progress"><i style={{ width: `${Math.min(100, Number(tile.stock_pieces || 0) / Math.max(1, Number(tile.min_stock_pieces || 1)) * 100)}%` }} /></div></div><div className="low-stock-number"><strong>{money(tile.stock_pieces)}</strong><span>шт.</span></div></div>)}</div> : <div className="success-empty"><PackageCheck size={25} /><strong>Остатки в норме</strong><span>Критически низких остатков нет.</span></div>}
        <button className="text-link" onClick={() => navigate('/stock')}>Посмотреть весь склад <ArrowRight size={14} /></button>
      </section>
    </div>

    <div className="dashboard-bottom-grid">
      <section className="card table-card">
        <div className="card-heading"><div><span className="section-kicker">ПОСЛЕДНИЕ ОПЕРАЦИИ</span><h2>Движение товара</h2></div><button className="button button-quiet" onClick={() => navigate('/stock')}>Все движения <ArrowRight size={15} /></button></div>
        <div className="table-wrap"><table><thead><tr><th>Товар</th><th>Операция</th><th>Склад</th><th>Количество</th><th>Дата</th></tr></thead><tbody>
          {movements.map((row) => <tr key={row.id}><td><strong className="mono">{row.tile_code}</strong><span className="sub-cell">{row.note || 'Без комментария'}</span></td><td><StatusPill status={row.type} /></td><td>{row.warehouse_code || 'MAIN'}</td><td className={Number(row.quantity_pieces) > 0 ? 'qty-positive' : 'qty-negative'}>{Number(row.quantity_pieces) > 0 ? '+' : ''}{money(row.quantity_pieces)} шт.</td><td className="muted-cell">{dateTime(row.created_at)}</td></tr>)}
        </tbody></table>{!movements.length && <div className="table-empty">По вашему запросу операций не найдено.</div>}</div>
      </section>
      <section className="card recent-sales-card">
        <div className="card-heading"><div><span className="section-kicker">АКТИВНОСТЬ</span><h2>Последние продажи</h2></div><button className="round-link" onClick={() => navigate('/sales')} aria-label="Все продажи"><ArrowRight size={17} /></button></div>
        <div className="recent-sales-list">{recentSales.map((sale, i) => <div className="recent-sale-item" key={sale.id || sale.number}><div className={`sale-icon sale-icon-${i % 3}`}><ShoppingBagIcon /></div><div className="recent-sale-info"><strong>{sale.customer_name || 'Розничный покупатель'}</strong><span>{sale.number} · {dateTime(sale.created_at)}</span></div><div className="recent-sale-amount"><strong>{money(sale.total_uzs)} сум</strong><span>{sale.warehouse_code || 'MAIN'}</span></div></div>)}</div>
        <button className="text-link" onClick={() => navigate('/sales')}>Все продажи <ArrowRight size={14} /></button>
      </section>
    </div>
  </>;
}

function ShoppingBagIcon() { return <ShoppingBag size={17} />; }
