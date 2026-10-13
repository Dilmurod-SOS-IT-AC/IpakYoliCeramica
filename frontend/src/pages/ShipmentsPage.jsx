import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ClipboardList, Plus, Search, Truck } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { PageHeading, SearchEmpty, StatusPill } from '../components/ui.jsx';

const money = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0));
const dateFormat = (value) => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}${String(value).length === 10 ? 'T12:00:00' : ''}`)) : 'Не указана';

export default function ShipmentsPage({ data, query = '', onCreateShipment, onReceiveShipment }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const filtered = useMemo(() => data.shipments.filter((s) => `${s.number} ${s.supplier_name} ${s.warehouse_code}`.toLowerCase().includes(query.toLowerCase()) && (tab === 'all' || s.status === tab)), [data.shipments, query, tab]);
  const inTransit = data.shipments.filter((s) => s.status === 'in_transit').length;
  const ordered = data.shipments.filter((s) => s.status === 'ordered').length;
  const arrived = data.shipments.filter((s) => s.status === 'arrived').length;

  async function receive(id) {
    setBusyId(id);
    try { await onReceiveShipment(id); } finally { setBusyId(null); }
  }

  return <>
    <PageHeading eyebrow="ЛОГИСТИКА И ЗАКУПКИ" title="Поставки" description="Контейнеры от поставщиков, сроки прибытия и приёмка товара на склад."
      action={<button className="button button-primary" onClick={() => setOpen(true)}><Plus size={17} /> Новая поставка</button>} />
    <div className="shipment-summary-grid"><div className="shipment-summary-card"><div className="shipment-summary-icon icon-sand"><ClipboardList size={19} /></div><div><span>Ожидают отправки</span><strong>{ordered}</strong><small>заказано</small></div></div><div className="shipment-summary-card"><div className="shipment-summary-icon icon-blue"><Truck size={19} /></div><div><span>В пути</span><strong>{inTransit}</strong><small>контейнеров</small></div></div><div className="shipment-summary-card"><div className="shipment-summary-icon icon-green"><Check size={19} /></div><div><span>Получено</span><strong>{arrived}</strong><small>всего в списке</small></div></div><div className="shipment-insight"><div className="insight-decoration">↗</div><strong>Планируйте приёмку заранее</strong><p>После прибытия используйте «Принять на склад», чтобы автоматически создать приходные движения и рассчитать себестоимость.</p></div></div>
    <section className="card table-card shipment-table-card">
      <div className="table-toolbar"><div className="section-tabs inline-tabs"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>Все поставки <span>{data.shipments.length}</span></button><button className={tab === 'ordered' ? 'selected' : ''} onClick={() => setTab('ordered')}>Заказаны</button><button className={tab === 'in_transit' ? 'selected' : ''} onClick={() => setTab('in_transit')}>В пути</button><button className={tab === 'arrived' ? 'selected' : ''} onClick={() => setTab('arrived')}>Получены</button></div><div className="table-toolbar-meta"><Search size={15} /><span>{filtered.length} поставок</span></div></div>
      {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Номер / дата</th><th>Поставщик</th><th>Склад</th><th>Позиций</th><th>Логистика + таможня</th><th>Ожидается</th><th>Статус</th><th>Действие</th></tr></thead><tbody>{filtered.map((s) => <tr key={s.id}><td><strong className="mono">{s.number}</strong><span className="sub-cell">Создана: {dateFormat(s.created_at?.slice(0, 10))}</span></td><td><div className="supplier-cell"><span className="supplier-avatar">{(s.supplier_name || 'S').slice(0, 1)}</span><strong>{s.supplier_name || '—'}</strong></div></td><td><span className="warehouse-code">{s.warehouse_code || 'MAIN'}</span></td><td>{s.items_count ?? s.items?.length ?? 0} SKU</td><td><strong>${money(Number(s.shipping_cost_usd || 0) + Number(s.customs_cost_usd || 0))}</strong><span className="sub-cell">USD</span></td><td><span className="date-cell"><CalendarDays size={14} />{dateFormat(s.arrival_date)}</span></td><td><StatusPill status={s.status} /></td><td>{s.status !== 'arrived' ? <button className="button button-small button-secondary" disabled={busyId === s.id} onClick={() => receive(s.id)}>{busyId === s.id ? 'Приёмка…' : 'Принять'} <ArrowRight size={14} /></button> : <span className="done-label"><Check size={14} /> Готово</span>}</td></tr>)}</tbody></table></div> : <SearchEmpty title="Поставок не найдено" hint="Измените фильтр статуса или поисковый запрос." />}
      <div className="catalog-footer"><span>Приёмка обновляет склад через inventory.services.receive_shipment.</span><a href="http://127.0.0.1:8000/admin/inventory/shipment/" target="_blank" rel="noreferrer">Открыть в Django Admin <ArrowRight size={14} /></a></div>
    </section>
    {open && <ShipmentModal data={data} onClose={() => setOpen(false)} onSubmit={async (payload) => { await onCreateShipment(payload); setOpen(false); }} />}
  </>;
}

function ShipmentModal({ data, onClose, onSubmit }) {
  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id || '');
  const [warehouseCode, setWarehouseCode] = useState(data.warehouses[0]?.code || 'MAIN');
  const [tileId, setTileId] = useState(data.tiles[0]?.id || '');
  const [quantity, setQuantity] = useState('120');
  const [price, setPrice] = useState(data.tiles[0]?.price_usd_per_m2 || '8.50');
  const [batch, setBatch] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [shipping, setShipping] = useState('0');
  const [customs, setCustoms] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const chosenTile = data.tiles.find((tile) => String(tile.id) === String(tileId));

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await onSubmit({ supplier_id: Number(supplierId), warehouse_code: warehouseCode, arrival_date: arrivalDate || null,
        shipping_cost_usd: Number(shipping || 0), customs_cost_usd: Number(customs || 0), notes,
        items: [{ tile_id: Number(tileId), quantity_pieces: Number(quantity), purchase_price_usd_per_m2: Number(price), batch_code: batch }] });
    } catch (err) { setError(err.message || 'Не удалось создать поставку.'); } finally { setSaving(false); }
  }

  return <Modal title="Новая поставка" subtitle="Зарегистрируйте заказ и добавьте позиции контейнера." onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid-two"><label className="field"><span>Поставщик *</span><select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field"><span>Склад назначения *</span><select required value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)}>{data.warehouses.map((w) => <option key={w.code} value={w.code}>{w.name} ({w.code})</option>)}</select></label></div>
      <div className="form-divider-label">СОСТАВ ПОСТАВКИ</div>
      <label className="field"><span>Плитка *</span><select required value={tileId} onChange={(e) => { setTileId(e.target.value); const t = data.tiles.find((x) => String(x.id) === e.target.value); if (t) setPrice(String(t.price_usd_per_m2)); }}>{data.tiles.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.size_label || `${t.width_mm} × ${t.height_mm}`}</option>)}</select></label>
      <div className="form-grid-two"><label className="field"><span>Количество, шт. *</span><input required min="1" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><label className="field"><span>Закупочная цена, USD / м² *</span><input required min="0.01" step="0.0001" type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label></div>
      <div className="form-grid-two"><label className="field"><span>Код партии / оттенок</span><input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="Например, LOT-24-A" /></label><label className="field"><span>Дата прибытия</span><input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} /></label></div>
      <div className="form-divider-label">ДОПОЛНИТЕЛЬНЫЕ РАСХОДЫ</div>
      <div className="form-grid-two"><label className="field"><span>Доставка, USD</span><input min="0" step="0.01" type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} /></label><label className="field"><span>Таможня, USD</span><input min="0" step="0.01" type="number" value={customs} onChange={(e) => setCustoms(e.target.value)} /></label></div>
      <label className="field"><span>Комментарий</span><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Необязательная информация о поставке" /></label>
      {chosenTile && <div className="modal-info-note"><Truck size={17} /><span>Товар поступит в остатки только после приёмки поставки. Номер документа сформируется автоматически, если его не передать.</span></div>}
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Отмена</button><button type="submit" className="button button-primary" disabled={saving || !supplierId || !tileId || Number(quantity) < 1}>{saving ? 'Сохранение…' : 'Создать поставку'}</button></div>
    </form>
  </Modal>;
}
