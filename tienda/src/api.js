export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const DIRECTORIO_URL = import.meta.env.VITE_DIRECTORIO_URL || 'http://localhost:5175';

export const img = (path) => (!path ? '' : path.startsWith('http') ? path : `${API_URL}${path}`);

export async function getJSON(path) {
  const res = await fetch(`${API_URL}/api${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
  return data;
}

export const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

/** Enlace de WhatsApp con mensaje prellenado. */
export const waLink = (phone, text = '') =>
  `https://wa.me/${String(phone).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
