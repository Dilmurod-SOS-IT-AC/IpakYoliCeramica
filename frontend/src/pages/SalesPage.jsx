import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Plus, ShoppingCart, Wallet } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { PageHeading, SearchEmpty, StatCard } from '../components/ui.jsx';

const money = (value, decimals = 0) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

export default function SalesPage({ data, query = '', onCreateSale, openRequest = 0, onConsumeOpenRequest }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openRequest > 0) { setOpen(true); onConsumeOpenRequest?.(); } }, [openRequest, onConsumeOpenRequest]);
  const filtered = useMemo(() => data.sales.filter((sale) => `${sale.number} ${sale.customer_name} ${sale.warehouse_code}`.toLowerCase().includes(query.toLowerCase())), [data.sales, query]);
  const totalUzs = data.sales.reduce((sum, sale) => sum + Number(sale.total_uzs || Number(sale.total_usd || 0) * 12600), 0);
  const totalUsd = data.sales.reduce((sum, sale) => sum + Number(sale.total_usd || 0), 0);
  return <>
    <PageHeading eyebrow="ТОРГОВЫЕ ОПЕРАЦИИ" title="Продажи" description="Продажи плитки, покупатели, суммы и склад отгрузки."
      action={<button className="button button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Новая продажа</button>} />
    <div className="stats-grid sales-stats"><StatCard label="Количество операций" value={data.sales.length} icon={ShoppingCart} tone="green" footnote="загруженных продаж" /><StatCard label="Общая сумма, USD" value={`$${money(totalUsd, 2)}`} icon={Wallet} tone="blue" footnote="по списку на экране" /><StatCard label="Выручка, UZS" value={`${money(totalUzs)} сум`} icon={ArrowUpRight} tone="violet" footnote="по сохранённому курсу сделки" /><StatCard label="Клиенты" value={data.customers.length} icon={ShoppingCart} tone="orange" footnote="в справочнике покупателей" /></div>
    <section className="card table-card sales-table-card"><div className="card-heading"><div><span className="section-kicker">ЖУРНАЛ СДЕЛОК</span><h2>История продаж</h2><p>Сумма и курс обмена фиксируются в момент продажи.</p></div><button className="button button-secondary" onClick={() => window.open('http://127.0.0.1:8000/admin/sales/sale/', '_blank', 'noopener,noreferrer')}><ArrowDownToLine size={16} /> Django Admin</button></div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Номер продажи</th><th>Покупатель</th><th>Склад</th><th>Позиций</th><th>Сумма, USD</th><th>Сумма, UZS</th><th>Дата и время</th><th>Сотрудник</th></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id || sale.number}><td><strong className="mono sale-number">{sale.number}</strong></td><td><div className="customer-cell"><span className="customer-avatar">{(sale.customer_name || 'Р').slice(0, 1)}</span><strong>{sale.customer_name || 'Розничный покупатель'}</strong></div></td><td><span className="warehouse-code">{sale.warehouse_code || 'MAIN'}</span></td><td>{sale.items_count ?? sale.items?.length ?? 0}</td><td><strong>${money(sale.total_usd, 2)}</strong></td><td><strong>{money(sale.total_uzs ?? Number(sale.total_usd || 0) * 12600)} сум</strong></td><td className="muted-cell">{dateTime(sale.created_at)}</td><td><span className="seller-tag"><span>{(sale.created_by_name || 'U').slice(0, 1).toUpperCase()}</span>{sale.created_by_name || '—'}</span></td></tr>)}</tbody></table></div> : <SearchEmpty title="Продажи не найдены" hint="Измените запрос или создайте новую продажу." />}
      <div className="catalog-footer"><span>Список содержит {filtered.length} операций</span><span className="footer-lock"><i /> Записи не удаляются физически</span></div>
    </section>
    {open && <SaleModal data={data} onClose={() => setOpen(false)} onSubmit={async (payload) => { await onCreateSale(payload); setOpen(false); }} />}
  </>;
}

function SaleModal({ data, onClose, onSubmit }) {
  const firstTile = data.tiles.find((tile) => tile.is_active !== false && Number(tile.stock_pieces || 0) > 0) || data.tiles[0];
  const [warehouseCode, setWarehouseCode] = useState(data.warehouses[0]?.code || 'MAIN');
  const [customerId, setCustomerId] = useState('');
  const [rate, setRate] = useState('12600');
  const [lines, setLines] = useState([{ key: 1, tile_id: firstTile?.id || '', quantity: '1', unit: 'box', discount_pct: '0' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateLine(index, field, value) { setLines((old) => old.map((line, i) => i === index ? { ...line, [field]: value } : line)); }
  function addLine() { setLines((old) => [...old, { key: Date.now(), tile_id: firstTile?.id || '', quantity: '1', unit: 'box', discount_pct: '0' }]); }
  function removeLine(index) { setLines((old) => old.length === 1 ? old : old.filter((_, i) => i !== index)); }
  const totalUsd = lines.reduce((sum, line) => {
    const tile = data.tiles.find((item) => String(item.id) === String(line.tile_id));
    if (!tile) return sum;
    const q = Math.max(0, Number(line.quantity || 0));
    const perPiece = Number(tile.width_mm || 0) * Number(tile.height_mm || 0) / 1_000_000;
    const pieces = line.unit === 'box' ? q * Number(tile.pieces_per_box || 1) : line.unit === 'm2' ? Math.ceil(q / Math.max(perPiece, 0.000001)) : q;
    return sum + pieces * perPiece * Number(tile.price_usd_per_m2 || 0) * (1 - Math.min(100, Number(line.discount_pct || 0)) / 100);
  }, 0);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await onSubmit({ warehouse_code: warehouseCode, exchange_rate: Number(rate), customer_id: customerId ? Number(customerId) : null,
        items: lines.map((line) => ({ tile_id: Number(line.tile_id), quantity: Number(line.quantity), unit: line.unit, discount_pct: Number(line.discount_pct || 0) })) });
    } catch (err) { setError(err.message || 'Не удалось сохранить продажу.'); } finally { setSaving(false); }
  }

  return <Modal title="Новая продажа" subtitle="Укажите покупателя, склад и товары для отгрузки." onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid-two"><label className="field"><span>Покупатель</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Розничный покупатель</option>{data.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label className="field"><span>Склад отгрузки *</span><select required value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>{data.warehouses.map((w) => <option value={w.code} key={w.code}>{w.name} ({w.code})</option>)}</select></label></div>
      <div className="form-grid-two"><label className="field"><span>Курс USD → UZS *</span><input required type="number" min="0.0001" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} /></label><div className="rate-hint"><strong>Курс фиксируется в продаже</strong><span>Итог в сумах рассчитывается по введённому курсу.</span></div></div>
      <div className="form-divider-label form-divider-between"><span>ТОВАРЫ В ПРОДАЖЕ</span><button className="text-link" type="button" onClick={addLine}><Plus size={14} /> Добавить позицию</button></div>
      <div className="sale-lines">{lines.map((line, index) => <div className="sale-line" key={line.key}><div className="sale-line-number">{String(index + 1).padStart(2, '0')}</div><div className="sale-line-fields"><label className="field"><span>Товар *</span><select required value={line.tile_id} onChange={(e) => updateLine(index, 'tile_id', e.target.value)}>{data.tiles.filter((tile) => tile.is_active !== false).map((tile) => <option key={tile.id} value={tile.id}>{tile.code} · {tile.size_label || `${tile.width_mm} × ${tile.height_mm}`}</option>)}</select></label><div className="form-grid-three"><label className="field"><span>Количество *</span><input required type="number" min={line.unit === 'm2' ? '0.01' : '1'} step={line.unit === 'm2' ? '0.01' : '1'} value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} /></label><label className="field"><span>Ед. измерения</span><select value={line.unit} onChange={(e) => updateLine(index, 'unit', e.target.value)}><option value="box">Коробки</option><option value="piece">Штуки</option><option value="m2">м²</option></select></label><label className="field"><span>Скидка, %</span><input type="number" min="0" max="100" step="0.1" value={line.discount_pct} onChange={(e) => updateLine(index, 'discount_pct', e.target.value)} /></label></div></div><button className="remove-line" type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} aria-label="Удалить позицию">×</button></div>)}</div>
      <div className="sale-total"><div><span>Предварительная сумма</span><strong>${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalUsd)}</strong></div><div><span>В сумах по выбранному курсу</span><strong>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(totalUsd * Number(rate || 0))} сум</strong></div></div>
      <div className="modal-info-note"><ShoppingCart size={17} /><span>Сервер повторно проверяет остатки и рассчитывает сумму. Если товара не хватает на складе, вся продажа будет отклонена без частичного списания.</span></div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Отмена</button><button type="submit" className="button button-primary" disabled={saving || !lines.every((line) => Number(line.quantity) > 0 && line.tile_id) || Number(rate) <= 0}>{saving ? 'Сохранение…' : 'Провести продажу'}</button></div>
    </form>
  </Modal>;
}
