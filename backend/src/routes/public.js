// API pública (sin login) usada por la Tienda (plataforma 2) y el Directorio (plataforma 3).
import { Router } from 'express';
import db from '../db.js';
import { getServices } from '../utils.js';
import { fuzzySearch } from '../search.js';

const r = Router();

const PUBLIC_COLS = `b.id, b.name, b.slug, b.description, b.category, b.city, b.neighborhood, b.address, b.maps_url, b.latitude, b.longitude,
  b.phone, b.whatsapp, b.email, b.facebook, b.instagram, b.tiktok, b.website, b.schedule, b.logo, b.cover, b.primary_color, b.slider_seconds`;

/** Directorio: lista de negocios activos con filtros por categoría, servicio, ciudad y texto. */
r.get('/businesses', (req, res) => {
  const { category, service, city, q } = req.query;
  const where = ['b.active = 1'];
  const params = [];
  if (category) { where.push('b.category = ?'); params.push(category); }
  if (city) { where.push('b.city = ?'); params.push(city); }
  if (service) {
    where.push('EXISTS (SELECT 1 FROM business_services s WHERE s.business_id = b.id AND s.name = ?)');
    params.push(service);
  }
  const rows = db
    .prepare(
      `SELECT ${PUBLIC_COLS},
         (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id AND p.active=1 AND p.in_catalog=1) AS products_count
         FROM businesses b WHERE ${where.join(' AND ')} ORDER BY b.name`
    )
    .all(...params);
  const list = rows.map((b) => ({ ...b, services: getServices(b.id) }));
  if (!q || !String(q).trim()) return res.json(list);

  // Búsqueda flexible (ver src/search.js): también mira los productos del catálogo
  const productsBy = new Map();
  if (list.length) {
    const ids = list.map((b) => b.id);
    db.prepare(
      `SELECT business_id, name, category FROM products
        WHERE active = 1 AND in_catalog = 1 AND business_id IN (${ids.map(() => '?').join(',')})`
    )
      .all(...ids)
      .forEach((p) => {
        const arr = productsBy.get(p.business_id) || [];
        arr.push(p);
        productsBy.set(p.business_id, arr);
      });
  }
  const docs = list.map((b) => {
    const prods = productsBy.get(b.id) || [];
    return {
      ...b,
      _products: prods.map((p) => p.name),
      _fields: {
        name: b.name,
        category: b.category,
        services: b.services.join(' '),
        products: prods.map((p) => `${p.name} ${p.category}`).join(' '),
        location: `${b.city} ${b.neighborhood}`,
        description: b.description,
      },
    };
  });
  res.json(fuzzySearch(String(q).slice(0, 100), docs).map(({ _fields, _products, ...b }) => b));
});

/** Opciones disponibles para los filtros del directorio. */
r.get('/filters', (_req, res) => {
  const col = (sql) => db.prepare(sql).all().map((r) => r.v);
  res.json({
    categories: col(`SELECT DISTINCT category v FROM businesses WHERE active=1 AND category != '' ORDER BY v`),
    cities: col(`SELECT DISTINCT city v FROM businesses WHERE active=1 AND city != '' ORDER BY v`),
    services: col(
      `SELECT DISTINCT s.name v FROM business_services s JOIN businesses b ON b.id = s.business_id WHERE b.active=1 ORDER BY v`
    ),
  });
});

/** Tienda: información completa de un negocio + catálogo + anuncios vigentes. */
r.get('/businesses/:slug', (req, res) => {
  const b = db.prepare(`SELECT ${PUBLIC_COLS} FROM businesses b WHERE b.slug = ? AND b.active = 1`).get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'Negocio no encontrado' });
  const products = db
    .prepare(
      `SELECT id, name, description, category, price, image, stock FROM products
        WHERE business_id = ? AND active = 1 AND in_catalog = 1 ORDER BY category, name`
    )
    .all(b.id);
  const ads = db
    .prepare(
      `SELECT id, title, content, image, link, starts_at, ends_at FROM ads
        WHERE business_id = ? AND active = 1
          AND (starts_at IS NULL OR date(starts_at) <= date('now','localtime'))
          AND (ends_at IS NULL OR date(ends_at) >= date('now','localtime'))
        ORDER BY created_at DESC`
    )
    .all(b.id);
  const slides = db
    .prepare('SELECT id, image, caption FROM business_slides WHERE business_id = ? ORDER BY sort_order, id')
    .all(b.id);
  res.json({ ...b, services: getServices(b.id), products, ads, slides });
});

/**
 * Negocios destacados para el slider del directorio: orden aleatorio, solo los que
 * tienen alguna imagen (portada o slider).
 */
r.get('/featured', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
  const rows = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.category, b.city, b.neighborhood, b.logo, b.primary_color,
              COALESCE(NULLIF(b.cover, ''),
                (SELECT s.image FROM business_slides s WHERE s.business_id = b.id ORDER BY s.sort_order, s.id LIMIT 1)) AS image
         FROM businesses b
        WHERE b.active = 1
          AND (b.cover != '' OR EXISTS (SELECT 1 FROM business_slides s WHERE s.business_id = b.id))
        ORDER BY RANDOM() LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

export default r;
