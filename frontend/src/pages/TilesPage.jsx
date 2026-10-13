import { useMemo, useState } from 'react';
import { Boxes, ChevronDown, Download, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeading, SearchEmpty, StatusPill, TileSwatch } from '../components/ui.jsx';

const money = (value) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

export default function TilesPage({ data, query = '' }) {
  const [sizeFilter, setSizeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const sizes = [...new Set(data.tiles.map((tile) => tile.size_label || `${tile.width_mm} × ${tile.height_mm}`))];
  const filtered = useMemo(() => data.tiles.filter((tile) => {
    const text = `${tile.code} ${tile.supplier_name} ${tile.size_label} ${tile.width_mm} ${tile.height_mm}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const size = tile.size_label || `${tile.width_mm} × ${tile.height_mm}`;
    const matchesSize = sizeFilter === 'all' || size === sizeFilter;
    const stock = Number(tile.stock_pieces ?? 0);
    const matchesStock = stockFilter === 'all' || (stockFilter === 'low' && stock <= Number(tile.min_stock_pieces || 0)) || (stockFilter === 'available' && stock > Number(tile.min_stock_pieces || 0));
    return matchesQuery && matchesSize && matchesStock;
  }), [data.tiles, query, sizeFilter, stockFilter]);

  return <>
    <PageHeading eyebrow="СПРАВОЧНИК ТОВАРОВ" title="Каталог плитки" description="Ассортимент, поставщики, размеры и текущие цены в одном месте."
      action={<button className="button button-secondary" onClick={() => window.open('http://127.0.0.1:8000/admin/catalog/tile/', '_blank', 'noopener,noreferrer')}><Plus size={17} /> Добавить товар в Django</button>} />
    <div className="catalog-summary-row"><div className="catalog-summary"><span className="catalog-summary-icon"><Boxes size={19} /></span><div><strong>{data.tiles.length}</strong><span>товарных позиций</span></div></div><div className="catalog-summary-note">Цены указаны в USD за м² <span className="note-dot" /> Остатки рассчитываются по движениям склада</div></div>

    <section className="card catalog-card">
      <div className="filters-row"><label className="table-search"><Search size={16} /><span className="sr-only">Поиск по каталогу</span><input value={query} readOnly placeholder="Поиск по коду или поставщику…" /></label><div className="filter-select-wrap"><SlidersHorizontal size={15} /><select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}><option value="all">Все размеры</option>{sizes.map((size) => <option value={size} key={size}>{size} мм</option>)}</select><ChevronDown size={14} /></div><div className="filter-select-wrap"><select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}><option value="all">Любой остаток</option><option value="available">В наличии</option><option value="low">Низкий остаток</option></select><ChevronDown size={14} /></div><span className="result-count">{filtered.length} из {data.tiles.length}</span></div>
      {filtered.length ? <div className="tiles-grid">{filtered.map((tile, index) => {
        const low = Number(tile.stock_pieces || 0) <= Number(tile.min_stock_pieces || 0);
        return <article className="tile-product-card" key={tile.id}>
          <div className="tile-product-visual"><TileSwatch tint={tile.tint || ['stone', 'sand', 'marble', 'green', 'clay'][index % 5]} large /><span className="tile-size-tag">{tile.size_label || `${tile.width_mm} × ${tile.height_mm}`} мм</span><button className="tile-more" title="Открыть товар в Django admin" onClick={() => window.open(`http://127.0.0.1:8000/admin/catalog/tile/${tile.id}/change/`, '_blank', 'noopener,noreferrer')}>↗</button></div>
          <div className="tile-product-content"><div className="tile-code-row"><span className="mono">{tile.code}</span><StatusPill status={tile.is_active === false ? 'inactive' : 'active'} /></div><h3>{tile.supplier_name || 'Поставщик не указан'}</h3><div className="tile-specs"><span>{tile.pieces_per_box} шт. / коробка</span><span>{money(tile.m2_per_box || (Number(tile.width_mm) * Number(tile.height_mm) / 1000000 * Number(tile.pieces_per_box)))} м²</span></div><div className="tile-product-footer"><div><strong>${money(tile.price_usd_per_m2)}</strong><span>за м²</span></div><div className={`tile-stock ${low ? 'is-low' : ''}`}><strong>{Number(tile.stock_pieces || 0).toLocaleString('ru-RU')}</strong><span>шт. на складе</span></div></div>{low && <div className="tile-low-note">Остаток ниже минимального уровня</div>}</div>
        </article>;
      })}</div> : <SearchEmpty title="Товары не найдены" hint="Попробуйте убрать фильтр размера или изменить поисковый запрос." />}
      <div className="catalog-footer"><span>Отображаются данные каталога плитки</span><button className="button button-quiet" onClick={() => window.open('http://127.0.0.1:8000/admin/catalog/tile/', '_blank', 'noopener,noreferrer')}><Download size={15} /> Управлять в Django Admin</button></div>
    </section>
  </>;
}
