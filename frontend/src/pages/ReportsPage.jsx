import { useMemo, useState } from 'react';
import { ArrowDownToLine, CalendarDays, ChartNoAxesCombined, FileSpreadsheet, Info, TrendingUp } from 'lucide-react';
import { PageHeading, StatCard } from '../components/ui.jsx';

const money = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0));

export default function ReportsPage({ data }) {
  const today = new Date();
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(todayString);
  const weekly = data.dashboard?.sales_week || [];
  const maxBar = Math.max(1, ...weekly.map((d) => Number(d.total_uzs || 0)));
  const lowStock = useMemo(() => data.tiles.filter((tile) => Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0)), [data.tiles]);
  const url = `/reports/sales.xlsx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return <>
    <PageHeading eyebrow="АНАЛИТИКА И ВЫГРУЗКИ" title="Отчёты" description="Контролируйте выручку, товарные остатки и движение за выбранный период."
      action={<a className="button button-primary button-link" href={url} target="_blank" rel="noreferrer"><FileSpreadsheet size={17} /> Скачать Excel</a>} />
    <div className="report-filter card"><div className="report-filter-title"><CalendarDays size={18} /><div><strong>Период отчёта</strong><span>Даты используются в существующем Django-отчёте продаж.</span></div></div><div className="report-date-fields"><label className="field"><span>Начало периода</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label><span className="date-dash">—</span><label className="field"><span>Конец периода</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label><a href={url} className="button button-secondary button-link" target="_blank" rel="noreferrer"><ArrowDownToLine size={16} /> Скачать файл</a></div></div>
    <div className="stats-grid report-stats"><StatCard label="Выручка по загруженным продажам" value={`${money(data.sales.reduce((sum, sale) => sum + Number(sale.total_uzs ?? Number(sale.total_usd || 0) * 12600), 0))} сум`} icon={TrendingUp} tone="green" footnote="по текущему списку продаж" /><StatCard label="Продаж в списке" value={data.sales.length} icon={FileSpreadsheet} tone="blue" footnote="показанные операции" /><StatCard label="SKU с низким остатком" value={lowStock.length} icon={ChartNoAxesCombined} tone="orange" footnote="на дату просмотра" /></div>
    <div className="reports-grid"><section className="card report-chart-card"><div className="card-heading"><div><span className="section-kicker">ВЫРУЧКА</span><h2>Продажи по дням</h2><p>Последние семь дней из API</p></div><span className="period-badge">7 дней</span></div><div className="report-chart-total"><strong>{money(weekly.reduce((sum, day) => sum + Number(day.total_uzs || 0), 0))} сум</strong><span>общая выручка периода</span></div><div className="bar-chart report-bar-chart">{weekly.map((item) => <div className="bar-column" key={item.date}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(4, Number(item.total_uzs || 0) / maxBar * 100)}%` }} title={`${money(item.total_uzs)} сум`} /></div><span>{item.label}</span></div>)}</div></section>
      <section className="card report-low-card"><div className="card-heading"><div><span className="section-kicker">СКЛАД</span><h2>Низкие остатки</h2><p>Нужно планировать закупку</p></div><span className="report-count-badge">{lowStock.length}</span></div>{lowStock.length ? <div className="report-low-list">{lowStock.map((tile) => <div className="report-low-item" key={tile.id}><div><strong>{tile.code}</strong><span>Минимум: {tile.min_stock_pieces} шт.</span></div><strong className="report-low-value">{tile.stock_pieces} шт.</strong></div>)}</div> : <p className="report-success">Все позиции выше минимального уровня.</p>}<a className="text-link" href="http://127.0.0.1:8000/admin/catalog/tile/" target="_blank" rel="noreferrer">Открыть каталог <span>↗</span></a></section></div>
    <div className="report-note"><Info size={18} /><div><strong>Что находится в Excel-файле?</strong><p>В backend уже существует маршрут <code>/reports/sales.xlsx</code>, который формирует листы Sales и Returns. Эта панель использует его напрямую; сам экспорт остаётся серверным, чтобы отчёт учитывал реальные записи базы данных.</p></div></div>
  </>;
}
