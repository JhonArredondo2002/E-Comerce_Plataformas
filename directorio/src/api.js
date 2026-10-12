export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const TIENDA_URL = import.meta.env.VITE_TIENDA_URL || 'http://localhost:5174';

export const img = (path) => (!path ? '' : path.startsWith('http') ? path : `${API_URL}${path}`);

export async function getJSON(path) {
  const res = await fetch(`${API_URL}/api${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const storeUrl = (slug) => `${TIENDA_URL}/${slug}`;
export const waLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, '')}`;
