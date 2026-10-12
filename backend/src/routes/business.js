// Perfil del negocio del usuario autenticado (lo que se muestra en la Tienda y el Directorio).
import { Router } from 'express';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { upload, fileUrl, removeUpload } from '../upload.js';
import { BUSINESS_FIELDS, getServices, setServices } from '../utils.js';

const r = Router();

r.get('/', (req, res) => {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
  res.json({ ...b, services: getServices(b.id) });
});

r.put(
  '/',
  requireRole('admin'),
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  (req, res) => {
    const current = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
    const data = {};
    for (const f of BUSINESS_FIELDS) {
      if (req.body[f] === undefined) continue;
      data[f] = ['latitude', 'longitude'].includes(f) ? (req.body[f] === '' ? null : Number(req.body[f])) : req.body[f];
    }
    if (data.name === '') return res.status(400).json({ error: 'El nombre es obligatorio' });
    const logo = fileUrl(req.files?.logo?.[0]);
    const cover = fileUrl(req.files?.cover?.[0]);
    if (logo) { data.logo = logo; removeUpload(current.logo); }
    if (cover) { data.cover = cover; removeUpload(current.cover); }
    const cols = Object.keys(data);
    if (cols.length)
      db.prepare(`UPDATE businesses SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
        ...cols.map((c) => data[c]),
        req.businessId
      );
    setServices(req.businessId, req.body.services);
    const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.businessId);
    res.json({ ...b, services: getServices(b.id) });
  }
);

// ───────── Slider del encabezado de la tienda ─────────
export const MAX_SLIDES = 10;
const listSlides = (businessId) =>
  db.prepare('SELECT id, image, caption, sort_order FROM business_slides WHERE business_id = ? ORDER BY sort_order, id').all(businessId);

r.get('/slides', (req, res) => res.json(listSlides(req.businessId)));

/** Sube una o varias imágenes (campo "images"). */
r.post('/slides', requireRole('admin'), upload.array('images', MAX_SLIDES), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Selecciona al menos una imagen' });
  const count = db.prepare('SELECT COUNT(*) n FROM business_slides WHERE business_id = ?').get(req.businessId).n;
  if (count + files.length > MAX_SLIDES) {
    files.forEach((f) => removeUpload(fileUrl(f)));
    return res.status(400).json({ error: `Máximo ${MAX_SLIDES} imágenes en el slider (tienes ${count})` });
  }
  let order = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM business_slides WHERE business_id = ?').get(req.businessId).m;
  const ins = db.prepare('INSERT INTO business_slides (business_id, image, sort_order) VALUES (?,?,?)');
  db.transaction(() => files.forEach((f) => ins.run(req.businessId, fileUrl(f), ++order)))();
  res.status(201).json(listSlides(req.businessId));
});

/** Segundos entre imágenes del slider (2 a 30). */
r.put('/slider-settings', requireRole('admin'), (req, res) => {
  const seconds = Math.round(Number(req.body?.seconds));
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 30)
    return res.status(400).json({ error: 'El tiempo debe estar entre 2 y 30 segundos' });
  db.prepare('UPDATE businesses SET slider_seconds = ? WHERE id = ?').run(seconds, req.businessId);
  res.json({ seconds });
});

/** Cambia el texto o la posición de una imagen. Body: { caption?, move?: 'up' | 'down' } */
r.put('/slides/:id', requireRole('admin'), (req, res) => {
  const slides = listSlides(req.businessId);
  const idx = slides.findIndex((s) => s.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Imagen no encontrada' });
  const { caption, move } = req.body || {};
  if (caption !== undefined) db.prepare('UPDATE business_slides SET caption = ? WHERE id = ?').run(String(caption), slides[idx].id);
  const to = move === 'up' ? idx - 1 : move === 'down' ? idx + 1 : idx;
  if (to !== idx && to >= 0 && to < slides.length) {
    const [item] = slides.splice(idx, 1);
    slides.splice(to, 0, item);
    const upd = db.prepare('UPDATE business_slides SET sort_order = ? WHERE id = ?');
    db.transaction(() => slides.forEach((s, i) => upd.run(i, s.id)))();
  }
  res.json(listSlides(req.businessId));
});

r.delete('/slides/:id', requireRole('admin'), (req, res) => {
  const s = db.prepare('SELECT * FROM business_slides WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Imagen no encontrada' });
  db.prepare('DELETE FROM business_slides WHERE id = ?').run(s.id);
  removeUpload(s.image);
  res.json(listSlides(req.businessId));
});

export default r;
