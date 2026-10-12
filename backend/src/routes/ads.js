import { Router } from 'express';
import db from '../db.js';
import { upload, fileUrl, removeUpload } from '../upload.js';
import { toBool } from '../utils.js';

const r = Router();
const nul = (v) => (v === '' || v === undefined || v === 'null' ? null : v);

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM ads WHERE business_id = ? ORDER BY created_at DESC, id DESC').all(req.businessId));
});

r.post('/', upload.single('image'), (req, res) => {
  const b = req.body;
  if (!b.title) return res.status(400).json({ error: 'El título es obligatorio' });
  const info = db
    .prepare('INSERT INTO ads (business_id, title, content, image, link, starts_at, ends_at, active) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.businessId, b.title, b.content || '', fileUrl(req.file) || '', b.link || '', nul(b.starts_at), nul(b.ends_at), toBool(b.active));
  res.status(201).json(db.prepare('SELECT * FROM ads WHERE id = ?').get(info.lastInsertRowid));
});

r.put('/:id', upload.single('image'), (req, res) => {
  const a = db.prepare('SELECT * FROM ads WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!a) return res.status(404).json({ error: 'Anuncio no encontrado' });
  const b = req.body;
  if (b.title === '') return res.status(400).json({ error: 'El título es obligatorio' });
  let image = a.image;
  if (req.file) { removeUpload(a.image); image = fileUrl(req.file); }
  else if (b.remove_image === '1') { removeUpload(a.image); image = ''; }
  db.prepare('UPDATE ads SET title=?, content=?, image=?, link=?, starts_at=?, ends_at=?, active=? WHERE id=?').run(
    b.title ?? a.title, b.content ?? a.content, image, b.link ?? a.link,
    b.starts_at !== undefined ? nul(b.starts_at) : a.starts_at,
    b.ends_at !== undefined ? nul(b.ends_at) : a.ends_at,
    toBool(b.active, a.active), a.id
  );
  res.json(db.prepare('SELECT * FROM ads WHERE id = ?').get(a.id));
});

r.delete('/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM ads WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!a) return res.status(404).json({ error: 'Anuncio no encontrado' });
  db.prepare('DELETE FROM ads WHERE id = ?').run(a.id);
  removeUpload(a.image);
  res.json({ ok: true });
});

export default r;
