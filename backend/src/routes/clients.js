import { Router } from 'express';
import db from '../db.js';

const r = Router();
const FIELDS = ['name', 'document', 'phone', 'email', 'address', 'notes'];

r.get('/', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const rows = db
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM sales s WHERE s.client_id = c.id AND s.status = 'completada') AS purchases,
         (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.client_id = c.id AND s.status = 'completada') AS total_spent
       FROM clients c
       WHERE c.business_id = ? AND (c.name LIKE ? OR c.document LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
       ORDER BY c.name`
    )
    .all(req.businessId, q, q, q, q);
  res.json(rows);
});

r.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM clients WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  const sales = db
    .prepare('SELECT id, total, status, payment_method, created_at FROM sales WHERE client_id = ? ORDER BY created_at DESC')
    .all(c.id);
  res.json({ ...c, sales });
});

r.post('/', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const vals = FIELDS.map((f) => req.body[f] ?? '');
  const info = db
    .prepare(`INSERT INTO clients (business_id, ${FIELDS.join(',')}) VALUES (?, ${FIELDS.map(() => '?').join(',')})`)
    .run(req.businessId, ...vals);
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM clients WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (req.body.name === '') return res.status(400).json({ error: 'El nombre es obligatorio' });
  const vals = FIELDS.map((f) => req.body[f] ?? c[f]);
  db.prepare(`UPDATE clients SET ${FIELDS.map((f) => `${f}=?`).join(',')} WHERE id = ?`).run(...vals, c.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(c.id));
});

r.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM clients WHERE id = ? AND business_id = ?').run(req.params.id, req.businessId);
  if (!info.changes) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ ok: true });
});

export default r;
