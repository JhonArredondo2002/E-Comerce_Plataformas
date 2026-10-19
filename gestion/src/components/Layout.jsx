import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BRAND } from '@shared/brand.js';
import { ThemeToggle } from '@shared/theme.jsx';
import DeveloperCredit from '@shared/DeveloperCredit.jsx';
import { useAuth } from '../auth.jsx';
import { TIENDA_URL, img } from '../api.js';

const BUSINESS_MENU = [
  { to: '/', label: 'Inicio', icon: '▦', end: true },
  { to: '/ventas', label: 'Ventas', icon: '＄' },
  { to: '/clientes', label: 'Clientes', icon: '☺' },
  { to: '/productos', label: 'Productos', icon: '▤' },
  { to: '/inventario', label: 'Inventario', icon: '⇅' },
  { to: '/proveedores', label: 'Proveedores', icon: '⇄' },
  { to: '/anuncios', label: 'Anuncios', icon: '✦' },
  { to: '/colaboradores', label: 'Colaboradores', icon: '◎' },
  { to: '/negocio', label: 'Mi negocio', icon: '⌂' },
];

const SUPER_MENU = [{ to: '/', label: 'Negocios', icon: '⌂', end: true }];

const ROLE_LABEL = { superadmin: 'Superadmin', admin: 'Administrador', colaborador: 'Colaborador' };

/**
 * En pantallas pequeñas las tablas se muestran como tarjetas. Para eso cada celda
 * necesita el título de su columna (data-label); lo copiamos automáticamente del <thead>.
 */
function useResponsiveTables(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const label = () => {
      el.querySelectorAll('table.table:not(.compact)').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach((tr) => {
          [...tr.children].forEach((td, i) => {
            const text = heads[i] || '';
            if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
          });
        });
      });
    };
    label();
    const obs = new MutationObserver(label);
    obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [ref]);
}

/** Iniciales del negocio (máx. 2 letras): "Café Aroma" → "CA". */
const initials = (name = '') =>
  name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w[0] || '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/** Tono de color estable a partir del nombre, para que cada negocio tenga su propio degradado. */
const hue = (name = '') => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 210);

/**
 * Avatar del negocio en el menú:
 *  - Logo del negocio si lo subió en "Mi negocio".
 *  - Si no tiene logo: sus iniciales sobre un degradado propio.
 *  - Superadmin: ícono de panel de control.
 */
function BusinessAvatar({ user }) {
  if (user.business_logo) return <img src={img(user.business_logo)} alt="" />;
  if (user.role === 'superadmin')
    return (
      <span className="brand-dot super" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </span>
    );
  const h = hue(user.business_name);
  return (
    <span
      className="brand-dot"
      title="Sube el logo de tu negocio en “Mi negocio”"
      style={{ background: `linear-gradient(135deg, hsl(${h} 75% 55%), hsl(${(h + 40) % 360} 70% 42%))` }}
    >
      {initials(user.business_name)}
    </span>
  );
}

export default function Layout() {
  const { user, logout, isSuper } = useAuth();
  const [open, setOpen] = useState(false);
  const mainRef = useRef(null);
  const location = useLocation();
  const menu = isSuper ? SUPER_MENU : BUSINESS_MENU;
  useResponsiveTables(mainRef);
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="kontrola-brand">
          <img src={BRAND.logo} alt="" />
          <span>{BRAND.name}</span>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <div className="brand">
          <BusinessAvatar user={user} />
          <div>
            <strong>{user.business_name || 'Administración'}</strong>
            <small>{ROLE_LABEL[user.role]}</small>
          </div>
        </div>
        <nav>
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}>
              <span className="icon">{m.icon}</span> {m.label}
            </NavLink>
          ))}
          <NavLink to="/cuenta">
            <span className="icon">⚙</span> Mi cuenta
          </NavLink>
        </nav>
        {user.business_slug && (
          <a className="store-link" href={`${TIENDA_URL}/${user.business_slug}`} target="_blank" rel="noreferrer">
            Ver mi tienda pública ↗
          </a>
        )}
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menú">☰</button>
          <span className="topbar-brand"><img src={BRAND.logo} alt="" /> {BRAND.name}</span>
          <span className="spacer" />
          <ThemeToggle className="icon-btn theme-toggle" />
          <span className="user-name">{user.name}</span>
          <button className="btn ghost small" onClick={logout}>Salir</button>
        </header>
        <main className="content" ref={mainRef}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <DeveloperCredit />
        </footer>
      </div>
    </div>
  );
}
