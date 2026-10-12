export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const TIENDA_URL = import.meta.env.VITE_TIENDA_URL || 'http://localhost:5174';

const TOKEN_KEY = 'gestion_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** Convierte rutas /uploads/... en URL absoluta del backend. */
export const img = (path) => (!path ? '' : path.startsWith('http') ? path : `${API_URL}${path}`);

/**
 * Cliente HTTP. Si body es FormData se envía como multipart (para imágenes);
 * si es objeto, como JSON.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/** Descarga un archivo protegido (ej. Excel) usando el token de la sesión. */
export async function apiDownload(path, filename) {
  const res = await fetch(`${API_URL}/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Construye un FormData a partir de un objeto, ignorando undefined. */
export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
    else if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  });
  return fd;
}

export const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export const dateTime = (s) => {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};
