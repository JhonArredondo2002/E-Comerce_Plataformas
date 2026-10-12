// Modo claro / oscuro compartido. La preferencia se guarda por navegador y,
// si el usuario nunca eligió, se usa la del sistema operativo.
import { useEffect, useState } from 'react';

const KEY = 'kontrola_theme';

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch { /* almacenamiento no disponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch { /* ignorar */ }
    setTheme(next);
  };
  return { theme, toggle };
}

/** Botón sol/luna para cambiar de tema. */
export function ThemeToggle({ className = 'theme-toggle' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className={className} onClick={toggle} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} title={dark ? 'Modo claro' : 'Modo oscuro'}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
