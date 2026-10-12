// Colaboradores del negocio. Todos los usuarios del negocio pueden verlos; solo el admin los gestiona.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { toBool } from '../utils.js';

const r = Router();
const COLS = 'id, name, email, role, position, phone, active, created_at';

r.get('/', (req, res) => {
  res.json(db.prepare(`SELECT ${COLS} FROM users WHERE business_id = ? ORDER BY role, name`).all(req.businessId));
});

r.post('/', requireRole('admin'), (req, res) => {
  const { name, email, password, role = 'colaborador', position = '', phone = '' } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  if (!['admin', 'colaborador'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email))
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  const info = db
    .prepare('INSERT INTO users (business_id, name, email, password_hash, role, position, phone) VALUES (?,?,?,?,?,?,?)')
    .run(req.businessId, name, email.trim(), bcrypt.hashSync(password, 10), role, position, phone);
  res.status(201).json(db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(info.lastInsertRowid));
});

r.put('/:id', requireRole('admin'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!u) return res.status(404).json({ error: 'Colaborador no encontrado' });
  const { name = u.name, email = u.email, role = u.role, position = u.position, phone = u.phone, password } = req.body || {};
  const active = toBool(req.body.active, u.active);
  if (!['admin', 'colaborador'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  if (u.id === req.user.id && (role !== 'admin' || !active))
    return res.status(400).json({ error: 'No puedes quitarte el rol de admin ni desactivarte a ti mismo' });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?').get(email, u.id))
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  db.prepare('UPDATE users SET name=?, email=?, role=?, position=?, phone=?, active=? WHERE id=?').run(
    name, email.trim(), role, position, phone, active, u.id
  );
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), u.id);
  }
  res.json(db.prepare(`SELECT ${COLS} FROM users WHERE id = ?`).get(u.id));
});

r.delete('/:id', requireRole('admin'), (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  const info = db.prepare('DELETE FROM users WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId);
  if (!info.changes) return res.status(404).json({ error: 'Colaborador no encontrado' });
  res.json({ ok: true });
});

export default r;
