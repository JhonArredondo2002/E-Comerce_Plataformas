import { Router } from 'express';
import db from '../db.js';
import { toNum } from '../utils.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();

const TYPE_LABEL = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', venta: 'Venta', anulacion: 'Anulación de venta' };

/** Filtros comunes: product_id, type, from, to (fechas YYYY-MM-DD en hora local). */
function movementsFilter(req) {
  const params = [req.businessId];
  let where = 'm.business_id = ?';
  const { product_id, type, from, to } = req.query;
  if (product_id) { where += ' AND m.product_id = ?'; params.push(product_id); }
  if (type && TYPE_LABEL[type]) { where += ' AND m.type = ?'; params.push(type); }
  if (from) { where += " AND date(m.created_at, 'localtime') >= date(?)"; params.push(from); }
  if (to) { where += " AND date(m.created_at, 'localtime') <= date(?)"; params.push(to); }
  return { where, params };
}

r.get('/movements', (req, res) => {
  const { where, params } = movementsFilter(req);
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

/** Descarga los movimientos (con los mismos filtros) y las existencias actuales en Excel. */
r.get('/movements/export', (req, res) => {
  const { where, params } = movementsFilter(req);
  const movements = db
    .prepare(
      `SELECT datetime(m.created_at, 'localtime') AS fecha, p.name AS producto, p.sku, p.category AS categoria,
              m.type, m.quantity AS cantidad, m.stock_after AS stock_final, m.reason AS motivo, u.name AS usuario
         FROM inventory_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN users u ON u.id = m.user_id
        WHERE ${where}
        ORDER BY m.created_at DESC, m.id DESC`
    )
    .all(...params)
    .map((m) => ({ ...m, tipo: TYPE_LABEL[m.type] || m.type }));

  const stock = db
    .prepare(
      `SELECT name AS producto, sku, category AS categoria, stock, min_stock AS minimo, cost AS costo, price AS precio,
              stock * cost AS valor_costo, stock * price AS valor_venta,
              CASE WHEN stock <= min_stock THEN 'Stock bajo' ELSE 'OK' END AS estado
         FROM products WHERE business_id = ? AND active = 1 ORDER BY name`
    )
    .all(req.businessId);

  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.businessId);
  const { from, to } = req.query;
  const period = from || to ? ` (${from || 'inicio'} a ${to || 'hoy'})` : '';
  const today = new Date().toISOString().slice(0, 10);

  sendXlsx(res, `movimientos-inventario-${today}.xlsx`, [
    {
      name: 'Movimientos',
      title: `${biz.name} · Movimientos de inventario${period}`,
      columns: [
        { header: 'Fecha', key: 'fecha', type: 'datetime', width: 18 },
        { header: 'Producto', key: 'producto', width: 32 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 18 },
        { header: 'Cantidad', key: 'cantidad', type: 'integer', width: 11 },
        { header: 'Stock final', key: 'stock_final', type: 'integer', width: 12 },
        { header: 'Motivo', key: 'motivo', width: 34 },
        { header: 'Usuario', key: 'usuario', width: 22 },
      ],
      rows: movements,
    },
    {
      name: 'Existencias',
      title: `${biz.name} · Existencias al ${today}`,
      columns: [
        { header: 'Producto', key: 'producto', width: 32 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Stock', key: 'stock', type: 'integer', width: 10 },
        { header: 'Mínimo', key: 'minimo', type: 'integer', width: 10 },
        { header: 'Costo unit.', key: 'costo', type: 'money', width: 14 },
        { header: 'Precio unit.', key: 'precio', type: 'money', width: 14 },
        { header: 'Valor a costo', key: 'valor_costo', type: 'money', width: 16 },
        { header: 'Valor a precio', key: 'valor_venta', type: 'money', width: 16 },
        { header: 'Estado', key: 'estado', width: 12 },
      ],
      rows: stock,
    },
  ]);
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
