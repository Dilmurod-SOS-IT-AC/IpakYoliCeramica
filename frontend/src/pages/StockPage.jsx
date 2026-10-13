import { DJANGO_BASE_URL } from '../config.js';
import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Filter, Search, Warehouse } from 'lucide-react';
import { PageHeading, StatCard, StatusPill, TileSwatch } from '../components/ui.jsx';

const money = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

export default function StockPage({ data, query = '' }) {
  const [warehouse, setWarehouse] = useState('all');
  const [mode, setMode] = useState('items');
  const filteredTiles = useMemo(() => data.tiles.filter((tile) => {
    const text = `${tile.code} ${tile.supplier_name} ${tile.size_label}`.toLowerCase();
    const stockOk = mode !== 'low' || Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0);
    return text.includes(query.toLowerCase()) && stockOk;
  }), [data.tiles, query, mode]);
  const filteredMovements = useMemo(() => data.movements.filter((row) => `${row.tile_code} ${row.note} ${row.type}`.toLowerCase().includes(query.toLowerCase()) && (warehouse === 'all' || row.warehouse_code === warehouse)), [data.movements, query, warehouse]);
  const totalPieces = data.tiles.reduce((sum, tile) => sum + Number(tile.stock_pieces || 0), 0);
  const totalM2 = data.tiles.reduce((sum, tile) => sum + Number(tile.stock_m2 ?? (Number(tile.stock_pieces || 0) * Number(tile.width_mm || 0) * Number(tile.height_mm || 0) / 1000000)), 0);
  const lowCount = data.tiles.filter((tile) => Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0)).length;
  const incoming = data.movements.filter((item) => Number(item.quantity_pieces) > 0).reduce((sum, item) => sum + Number(item.quantity_pieces), 0);
  const outgoing = data.movements.filter((item) => Number(item.quantity_pieces) < 0).reduce((sum, item) => sum + Math.abs(Number(item.quantity_pieces)), 0);

  return <>
    <PageHeading eyebrow="УЧЁТ ОСТАТКОВ" title="Склад и остатки" description="Актуальные остатки плитки и журнал движения товара по складам."
      action={<button className="button button-secondary" onClick={() => window.open('${DJANGO_BASE_URL}/admin/inventory/stockmovement/', '_blank', 'noopener,noreferrer')}><Download size={16} /> Экспорт / Admin</button>} />
    <div className="stats-grid stock-stats"><StatCard label="Остаток, шт." value={money(totalPieces)} icon={Warehouse} tone="green" footnote="по всем товарам" /><StatCard label="Остаток, м²" value={new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(totalM2)} icon={Warehouse} tone="blue" footnote="расчётная площадь" /><StatCard label="Низкий остаток" value={lowCount} icon={Filter} tone="orange" footnote="SKU ниже минимума" /><StatCard label="Приход / расход" value={`${money(incoming)} / ${money(outgoing)}`} icon={ArrowUpRight} tone="violet" footnote="в журнале операций" /></div>
    <section className="card stock-card">
      <div className="section-tabs"><button className={mode === 'items' ? 'selected' : ''} onClick={() => setMode('items')}>Остатки по товарам</button><button className={mode === 'low' ? 'selected' : ''} onClick={() => setMode('low')}>Низкий остаток <span>{lowCount}</span></button><button className={mode === 'movements' ? 'selected' : ''} onClick={() => setMode('movements')}>Журнал движения</button></div>
      {mode !== 'movements' ? <div className="table-wrap"><table><thead><tr><th>Товар</th><th>Поставщик</th><th>Размер</th><th>Остаток, шт.</th><th>Остаток, м²</th><th>Минимум</th><th>Статус</th></tr></thead><tbody>{filteredTiles.map((tile, index) => { const low = Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0); return <tr key={tile.id}><td><div className="product-cell"><TileSwatch tint={tile.tint || ['stone', 'sand', 'marble', 'green'][index % 4]} /><div><strong className="mono">{tile.code}</strong><span className="sub-cell">{tile.pieces_per_box} шт. / коробка</span></div></div></td><td>{tile.supplier_name || '—'}</td><td>{tile.size_label || `${tile.width_mm} × ${tile.height_mm}`}</td><td><strong>{money(tile.stock_pieces)}</strong></td><td>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(tile.stock_m2 ?? Number(tile.stock_pieces || 0) * Number(tile.width_mm || 0) * Number(tile.height_mm || 0) / 1000000))}</td><td>{money(tile.min_stock_pieces)} шт.</td><td><StatusPill status={low ? 'write_off' : 'active'} /></td></tr>; })}</tbody></table>{!filteredTiles.length && <div className="table-empty">Подходящих товаров нет.</div>}</div> : <div className="table-wrap"><div className="movement-filter"><span>Операции склада</span><label className="filter-select-wrap"><Warehouse size={15} /><select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="all">Все склады</option>{data.warehouses.map((w) => <option value={w.code} key={w.code}>{w.name} ({w.code})</option>)}</select></label></div><table><thead><tr><th>Товар</th><th>Тип операции</th><th>Склад</th><th>Количество</th><th>Комментарий</th><th>Дата</th></tr></thead><tbody>{filteredMovements.map((row) => <tr key={row.id}><td><strong className="mono">{row.tile_code}</strong></td><td><StatusPill status={row.type} /></td><td>{row.warehouse_code}</td><td className={Number(row.quantity_pieces) > 0 ? 'qty-positive' : 'qty-negative'}>{Number(row.quantity_pieces) > 0 ? '+' : ''}{money(row.quantity_pieces)} шт.</td><td>{row.note || '—'}</td><td className="muted-cell">{dateTime(row.created_at)}</td></tr>)}</tbody></table>{!filteredMovements.length && <div className="table-empty">Операции не найдены.</div>}</div>}
      <div className="catalog-footer"><span>Остаток считается как сумма движений склада — вручную количество не редактируется.</span><span className="footer-lock"><i /> История операций сохраняется</span></div>
    </section>
    <div className="stock-note"><div className="stock-note-icon"><ArrowDownLeft size={18} /></div><div><strong>Остатки вычисляются автоматически</strong><p>Приходы, продажи и возвраты формируют журнал движений. Чтобы сохранить корректность учёта, не изменяйте остаток вручную в интерфейсе.</p></div></div>
  </>;
}
