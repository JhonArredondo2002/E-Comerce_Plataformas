import { Router } from 'express';
import db from '../db.js';
import { toNum } from '../utils.js';

const r = Router();

r.get('/movements', (req, res) => {
  const params = [req.businessId];
  let where = 'm.business_id = ?';
  if (req.query.product_id) { where += ' AND m.product_id = ?'; params.push(req.query.product_id); }
  const rows = db
    .prepare(
      `SELECT m.*, p.name AS product_name, u.name AS user_name
         FROM inventory_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN users u ON u.id = m.user_id
        WHERE ${where}
        ORDER BY m.created_at DESC, m.id DESC LIMIT 300`
    )
    .all(...params);
  res.json(rows);
});

/**
 * Registra un movimiento manual:
 *  - entrada: suma cantidad
 *  - salida:  resta cantidad
 *  - ajuste:  fija el stock al valor indicado (quantity = nuevo stock)
 */
r.post('/movements', (req, res) => {
  const { product_id, type, reason = '' } = req.body || {};
  const qty = Math.trunc(toNum(req.body?.quantity, NaN));
  if (!['entrada', 'salida', 'ajuste'].includes(type)) return res.status(400).json({ error: 'Tipo de movimiento inválido' });
  if (!Number.isFinite(qty) || qty < 0 || (type !== 'ajuste' && qty === 0))
    return res.status(400).json({ error: 'Cantidad inválida' });
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(product_id, req.businessId);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });

  let newStock = p.stock;
  let delta = qty;
  if (type === 'entrada') newStock = p.stock + qty;
  if (type === 'salida') {
    if (qty > p.stock) return res.status(400).json({ error: `Stock insuficiente (disponible: ${p.stock})` });
    newStock = p.stock - qty;
    delta = -qty;
  }
  if (type === 'ajuste') { newStock = qty; delta = qty - p.stock; }

  db.transaction(() => {
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, p.id);
    db.prepare(
      `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason) VALUES (?,?,?,?,?,?,?)`
    ).run(req.businessId, p.id, req.user.id, type, delta, newStock, reason);
  })();
  res.status(201).json({ product_id: p.id, stock: newStock });
});

export default r;
