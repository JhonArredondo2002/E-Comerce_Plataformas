import db from './db.js';

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uniqueSlug(name, excludeId = null) {
  const base = slugify(name) || 'negocio';
  let slug = base;
  let i = 2;
  while (db.prepare('SELECT id FROM businesses WHERE slug = ? AND id IS NOT ?').get(slug, excludeId)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/** Convierte "1"/"true"/true a 1 y lo demás a 0 (útil con FormData). */
export const toBool = (v, def = 1) => (v === undefined ? def : v === true || v === 'true' || v === '1' || v === 1 ? 1 : 0);

export const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/** Guarda la lista de servicios de un negocio (array o texto separado por comas). */
export function setServices(businessId, services) {
  if (services === undefined) return;
  let list = services;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(',');
    }
  }
  list = [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))];
  db.prepare('DELETE FROM business_services WHERE business_id = ?').run(businessId);
  const ins = db.prepare('INSERT INTO business_services (business_id, name) VALUES (?, ?)');
  list.forEach((s) => ins.run(businessId, s));
}

export function getServices(businessId) {
  return db
    .prepare('SELECT name FROM business_services WHERE business_id = ? ORDER BY name')
    .all(businessId)
    .map((r) => r.name);
}

export const BUSINESS_FIELDS = [
  'name', 'description', 'category', 'city', 'neighborhood', 'address', 'maps_url', 'latitude', 'longitude',
  'phone', 'whatsapp', 'email', 'facebook', 'instagram', 'tiktok', 'website', 'schedule', 'primary_color',
];

/** Envuelve handlers async para enviar errores al middleware de errores. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
