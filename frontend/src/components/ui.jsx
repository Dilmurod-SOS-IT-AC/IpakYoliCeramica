import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function StatCard({ label, value, trend, trendLabel, icon: Icon, tone = 'green', footnote }) {
  const positive = typeof trend === 'number' && trend > 0;
  const negative = typeof trend === 'number' && trend < 0;
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></div></div><div className="stat-value">{value}</div><div className="stat-bottom">{trend !== undefined && trend !== null ? <span className={`trend ${positive ? 'up' : negative ? 'down' : ''}`}>{positive ? <ArrowUpRight size={14} /> : negative ? <ArrowDownRight size={14} /> : <Minus size={14} />}{Math.abs(trend)}%</span> : null}<span>{trendLabel || footnote}</span></div></article>;
}

export function StatusPill({ status }) {
  const labels = {
    ordered: ['Заказана', 'status-neutral'],
    in_transit: ['В пути', 'status-blue'],
    arrived: ['Получена', 'status-green'],
    incoming: ['Приход', 'status-green'],
    sale: ['Продажа', 'status-orange'],
    return: ['Возврат', 'status-blue'],
    write_off: ['Списание', 'status-red'],
    adjustment: ['Корректировка', 'status-neutral'],
    active: ['Активен', 'status-green'],
    inactive: ['Неактивен', 'status-neutral']
  };
  const [label, klass] = labels[status] || [status || '—', 'status-neutral'];
  return <span className={`status-pill ${klass}`}><i />{label}</span>;
}

export function SearchEmpty({ title = 'Ничего не найдено', hint = 'Попробуйте изменить запрос или фильтры.' }) {
  return <div className="empty-state"><div className="empty-state-mark">⌕</div><strong>{title}</strong><span>{hint}</span></div>;
}

export function TileSwatch({ tint = 'stone', large = false }) {
  return <div className={`tile-swatch swatch-${tint} ${large ? 'tile-swatch-large' : ''}`} aria-hidden="true"><div className="swatch-grout" /><div className="swatch-highlight" /></div>;
}
