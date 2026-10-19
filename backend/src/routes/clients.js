import { Router } from 'express';
import db from '../db.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();
const FIELDS = ['name', 'document', 'phone', 'email', 'address', 'notes'];

function listClients(req) {
  const q = `%${req.query.q || ''}%`;
  return db
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM sales s WHERE s.client_id = c.id AND s.status = 'completada') AS purchases,
         (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.client_id = c.id AND s.status = 'completada') AS total_spent,
         (SELECT datetime(MAX(created_at), 'localtime') FROM sales s WHERE s.client_id = c.id AND s.status = 'completada') AS last_purchase
       FROM clients c
       WHERE c.business_id = ? AND (c.name LIKE ? OR c.document LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
       ORDER BY c.name`
    )
    .all(req.businessId, q, q, q, q);
}

r.get('/', (req, res) => res.json(listClients(req)));

/** Exporta a Excel los clientes (respeta la búsqueda) con su historial de compras resumido. */
r.get('/export', (req, res) => {
  const rows = listClients(req).map((c) => ({
    ...c,
    created: db.prepare(`SELECT datetime(?, 'localtime') AS d`).get(c.created_at).d,
    avg_ticket: c.purchases ? c.total_spent / c.purchases : null,
  }));
  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.businessId);
  sendXlsx(res, `clientes-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: 'Clientes',
    title: `${biz.name} · Clientes`,
    columns: [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Documento', key: 'document', width: 16 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Correo', key: 'email', width: 28 },
      { header: 'Dirección', key: 'address', width: 28 },
      { header: 'Compras', key: 'purchases', type: 'integer', width: 10 },
      { header: 'Total comprado', key: 'total_spent', type: 'money', width: 16 },
      { header: 'Compra promedio', key: 'avg_ticket', type: 'money', width: 16 },
      { header: 'Última compra', key: 'last_purchase', type: 'datetime', width: 18 },
      { header: 'Registrado el', key: 'created', type: 'datetime', width: 18 },
      { header: 'Notas', key: 'notes', width: 30 },
    ],
    rows,
    totals: ['purchases', 'total_spent'],
  }]);
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
