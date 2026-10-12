import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const r = Router();

function profile(userId) {
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.position, u.phone, u.business_id,
              b.name AS business_name, b.slug AS business_slug, b.logo AS business_logo
         FROM users u LEFT JOIN businesses b ON b.id = u.business_id WHERE u.id = ?`
    )
    .get(userId);
  return user;
}

r.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  if (!user.active) return res.status(403).json({ error: 'Tu usuario está desactivado' });
  if (user.business_id) {
    const b = db.prepare('SELECT active FROM businesses WHERE id = ?').get(user.business_id);
    if (!b?.active) return res.status(403).json({ error: 'El negocio está desactivado' });
  }
  res.json({ token: signToken(user), user: profile(user.id) });
});

r.get('/me', requireAuth, (req, res) => res.json(profile(req.user.id)));

r.put('/me/password', requireAuth, (req, res) => {
  const { current, password } = req.body || {};
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current || '', u.password_hash))
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 6 caracteres' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.user.id);
  res.json({ ok: true });
});

export default r;
