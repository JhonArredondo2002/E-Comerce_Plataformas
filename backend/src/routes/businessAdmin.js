// Rutas exclusivas del SUPERADMIN de la plataforma: crear y administrar negocios.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { upload, fileUrl, removeUpload } from '../upload.js';
import { BUSINESS_FIELDS, getServices, setServices, toBool, uniqueSlug } from '../utils.js';

const r = Router();
r.use(requireRole('superadmin'));

const businessUpload = upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

function pickFields(body) {
  const data = {};
  for (const f of BUSINESS_FIELDS) {
    if (body[f] === undefined) continue;
    data[f] = ['latitude', 'longitude'].includes(f) ? (body[f] === '' || body[f] === null ? null : Number(body[f])) : body[f];
  }
  return data;
}

r.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM users u WHERE u.business_id = b.id) AS users_count,
        (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) AS products_count
       FROM businesses b ORDER BY b.created_at DESC`
    )
    .all();
  res.json(rows.map((b) => ({ ...b, services: getServices(b.id) })));
});

r.get('/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Negocio no encontrado' });
  const users = db
    .prepare('SELECT id, name, email, role, active FROM users WHERE business_id = ? ORDER BY role, name')
    .all(b.id);
  res.json({ ...b, services: getServices(b.id), users });
});

/** Crea un negocio junto con su usuario administrador. */
r.post('/', businessUpload, (req, res) => {
  const body = req.body;
  const { admin_name, admin_email, admin_password } = body;
  if (!body.name) return res.status(400).json({ error: 'El nombre del negocio es obligatorio' });
  if (!admin_name || !admin_email || !admin_password)
    return res.status(400).json({ error: 'Nombre, correo y contraseña del administrador son obligatorios' });
  if (admin_password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(admin_email))
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

  const data = pickFields(body);
  data.slug = uniqueSlug(body.slug || body.name);
  data.logo = fileUrl(req.files?.logo?.[0]) || '';
  data.cover = fileUrl(req.files?.cover?.[0]) || '';
  data.active = toBool(body.active);

  const tx = db.transaction(() => {
    const cols = Object.keys(data);
    const info = db
      .prepare(`INSERT INTO businesses (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => data[c]));
    const businessId = info.lastInsertRowid;
    setServices(businessId, body.services);
    db.prepare(
      `INSERT INTO users (business_id, name, email, password_hash, role, position) VALUES (?, ?, ?, ?, 'admin', 'Administrador')`
    ).run(businessId, admin_name, admin_email.trim(), bcrypt.hashSync(admin_password, 10));
    return businessId;
  });
  const id = tx();
  res.status(201).json({ id, slug: data.slug });
});

r.put('/:id', businessUpload, (req, res) => {
  const current = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Negocio no encontrado' });
  const data = pickFields(req.body);
  if (req.body.slug && req.body.slug !== current.slug) data.slug = uniqueSlug(req.body.slug, current.id);
  if (req.body.active !== undefined) data.active = toBool(req.body.active);
  const logo = fileUrl(req.files?.logo?.[0]);
  const cover = fileUrl(req.files?.cover?.[0]);
  if (logo) { data.logo = logo; removeUpload(current.logo); }
  if (cover) { data.cover = cover; removeUpload(current.cover); }
  const cols = Object.keys(data);
  if (cols.length)
    db.prepare(`UPDATE businesses SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...cols.map((c) => data[c]),
      current.id
    );
  setServices(current.id, req.body.services);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM businesses WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Negocio no encontrado' });
  res.json({ ok: true });
});

/** Permite al superadmin crear otro administrador para un negocio existente. */
r.post('/:id/admins', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Nombre, correo y contraseña (mín. 6) son obligatorios' });
  if (!db.prepare('SELECT id FROM businesses WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Negocio no encontrado' });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email))
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  const info = db
    .prepare(`INSERT INTO users (business_id, name, email, password_hash, role, position) VALUES (?, ?, ?, ?, 'admin', 'Administrador')`)
    .run(req.params.id, name, email.trim(), bcrypt.hashSync(password, 10));
  res.status(201).json({ id: info.lastInsertRowid });
});

export default r;
