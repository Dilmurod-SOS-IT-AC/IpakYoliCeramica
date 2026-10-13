import { DJANGO_BASE_URL } from '../config.js';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine, Bell, Boxes, ChevronDown, CircleHelp, Command, FileBarChart,
  LayoutDashboard, LogOut, PackageCheck, Search, ShoppingBag, Warehouse, X
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
    {
        label: 'Склад и остатки',
        to: '/stock',
        icon: Warehouse
    }
];

export default function Layout({ user, demoMode, onLogout, onNewSale, globalQuery, setGlobalQuery, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = location.pathname === '/stock'
  ? 'Склад и остатки'
  : 'Обзор';


  const sidebarContents = (
    <>
      <div className="brand-lockup">
        <div className="brand-symbol"><span>IP</span><i /></div>
        <div className="brand-wordmark"><strong>IPAK YOLI</strong><span>CERAMICA</span></div>
        <button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню"><X size={18} /></button>
      </div>
      <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav className="side-nav" aria-label="Основная навигация">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            {to === '/stock' && <span className="nav-count">4</span>}
          </NavLink>
        ))}
        <a
    className="nav-item"
    href={`${DJANGO_BASE_URL}/admin/`}
        >
         <LayoutDashboard size={18} strokeWidth={1.8} />
        <span>Панель Django</span>
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="support-card">
          <div className="support-icon"><CircleHelp size={17} /></div>
          <strong>Нужна помощь?</strong>
          <p>Подсказки по работе со складом и продажами.</p>
          <button onClick={() => window.open('https://github.com/Dilmurod-SOS-IT-AC/IpakYoliCeramica', '_blank', 'noopener,noreferrer')}>Документация <ArrowDownToLine size={14} /></button>
        </div>
        <button className="profile-row" onClick={onLogout} title="Выйти из системы">
          <div className="avatar avatar-sidebar">{(user?.username || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="profile-text"><strong>{user?.username || 'Пользователь'}</strong><span>{demoMode ? 'Демо-режим' : (user?.role || 'Сотрудник')}</span></div>
          <LogOut size={16} className="profile-logout" />
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebarContents}</aside>
      {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
      {mobileOpen && <aside className="sidebar sidebar-mobile">{sidebarContents}</aside>}
      <main className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Открыть меню" onClick={() => setMobileOpen(true)}><Command size={19} /></button>
          <div className="breadcrumbs"><span>Рабочее пространство</span><span className="crumb-separator">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={17} /><input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} placeholder="Поиск по странице…" /><kbd>⌘ K</kbd></label>
            <button className="top-icon icon-button" title="Уведомления" onClick={() => navigate('/stock')}><Bell size={18} /><i className="notification-dot" /></button>
            <div className="topbar-divider" />
            <button className="top-user" onClick={() =>window.location.assign(`${DJANGO_BASE_URL}/admin/`)}>
              <div className="avatar">{(user?.username || 'U').slice(0, 1).toUpperCase()}</div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        {/* {demoMode && <div className="demo-banner"><span className="demo-pulse" /><div><strong>Демо-режим</strong> — показаны примеры данных, они не сохраняются в вашей базе Django.
        </div><button
    onClick={() =>
        window.location.assign(`${DJANGO_BASE_URL}/admin/`)
    }
>
    Как подключить backend
</button></div>} */}
        <div className="page-content">{children}</div>
        <footer className="app-footer"><span>© 2026 Ipak Yoli Ceramica</span><span>Система складского и торгового учёта</span><span className="footer-status"><i /> {demoMode ? 'Демо-среда' : 'Рабочая среда'}</span></footer>
      </main>
    </div>
  );
}
