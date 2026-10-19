// Proveedores del negocio. Todos los usuarios del negocio pueden consultarlos y gestionarlos.
import { Router } from 'express';
import db from '../db.js';
import { toBool } from '../utils.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();
const FIELDS = ['name', 'document', 'contact_name', 'phone', 'email', 'address', 'supplies', 'notes'];

const LIST_SQL = `
  SELECT s.*,
    (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS products_count,
    (SELECT COUNT(*) FROM inventory_movements m WHERE m.supplier_id = s.id AND m.type = 'entrada') AS purchases_count,
    (SELECT COALESCE(SUM(m.quantity * COALESCE(m.unit_cost, 0)), 0) FROM inventory_movements m
      WHERE m.supplier_id = s.id AND m.type = 'entrada') AS purchases_total,
    (SELECT MAX(m.created_at) FROM inventory_movements m WHERE m.supplier_id = s.id AND m.type = 'entrada') AS last_purchase
  FROM suppliers s
  WHERE s.business_id = ? AND (s.name LIKE ? OR s.document LIKE ? OR s.contact_name LIKE ? OR s.supplies LIKE ?)
  ORDER BY s.active DESC, s.name`;

const list = (req) => {
  const q = `%${req.query.q || ''}%`;
  return db.prepare(LIST_SQL).all(req.businessId, q, q, q, q);
};

r.get('/', (req, res) => res.json(list(req)));

r.get('/export', (req, res) => {
  const rows = list(req).map((s) => ({
    ...s,
    estado: s.active ? 'Activo' : 'Inactivo',
    last_purchase: s.last_purchase ? db.prepare(`SELECT datetime(?, 'localtime') AS d`).get(s.last_purchase).d : '',
  }));
  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.businessId);
  sendXlsx(res, `proveedores-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: 'Proveedores',
    title: `${biz.name} · Proveedores`,
    columns: [
      { header: 'Proveedor', key: 'name', width: 30 },
      { header: 'NIT / Documento', key: 'document', width: 16 },
      { header: 'Contacto', key: 'contact_name', width: 22 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Correo', key: 'email', width: 26 },
      { header: 'Dirección', key: 'address', width: 28 },
      { header: 'Qué suministra', key: 'supplies', width: 28 },
      { header: 'Productos asociados', key: 'products_count', type: 'integer', width: 12 },
      { header: 'Compras registradas', key: 'purchases_count', type: 'integer', width: 12 },
      { header: 'Valor comprado', key: 'purchases_total', type: 'money', width: 16 },
      { header: 'Última compra', key: 'last_purchase', type: 'datetime', width: 18 },
      { header: 'Estado', key: 'estado', width: 10 },
      { header: 'Notas', key: 'notes', width: 30 },
    ],
    rows,
    totals: ['purchases_count', 'purchases_total'],
  }]);
});

r.get('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Proveedor no encontrado' });
  s.products = db
    .prepare('SELECT id, name, sku, stock, cost FROM products WHERE supplier_id = ? AND business_id = ? ORDER BY name')
    .all(s.id, req.businessId);
  s.purchases = db
    .prepare(
      `SELECT m.id, m.created_at, m.quantity, m.unit_cost, m.reason, p.name AS product_name, u.name AS user_name
         FROM inventory_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
        WHERE m.supplier_id = ? AND m.business_id = ? AND m.type = 'entrada'
        ORDER BY m.created_at DESC, m.id DESC LIMIT 100`
    )
    .all(s.id, req.businessId);
  res.json(s);
});

r.post('/', (req, res) => {
  if (!req.body?.name?.trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  const vals = FIELDS.map((f) => String(req.body[f] ?? '').trim());
  const info = db
    .prepare(`INSERT INTO suppliers (business_id, ${FIELDS.join(',')}, active) VALUES (?, ${FIELDS.map(() => '?').join(',')}, ?)`)
    .run(req.businessId, ...vals, toBool(req.body.active));
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Proveedor no encontrado' });
  if (req.body.name !== undefined && !String(req.body.name).trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  const vals = FIELDS.map((f) => (req.body[f] !== undefined ? String(req.body[f]).trim() : s[f]));
  db.prepare(`UPDATE suppliers SET ${FIELDS.map((f) => `${f}=?`).join(',')}, active=? WHERE id = ?`).run(
    ...vals, toBool(req.body.active, s.active), s.id
  );
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(s.id));
});

/** Al eliminar, los productos y compras asociados quedan "sin proveedor" (no se borran). */
r.delete('/:id', (req, res) => {
  const s = db.prepare('SELECT id FROM suppliers WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Proveedor no encontrado' });
  db.transaction(() => {
    db.prepare('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?').run(s.id);
    db.prepare('UPDATE inventory_movements SET supplier_id = NULL WHERE supplier_id = ?').run(s.id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(s.id);
  })();
  res.json({ ok: true });
});

export default r;
