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
  if (req.query.supplier_id) { where += ' AND m.supplier_id = ?'; params.push(req.query.supplier_id); }
  return { where, params };
}

r.get('/movements', (req, res) => {
  const { where, params } = movementsFilter(req);
  const rows = db
    .prepare(
      `SELECT m.*, p.name AS product_name, u.name AS user_name, s.name AS supplier_name
         FROM inventory_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN users u ON u.id = m.user_id
         LEFT JOIN suppliers s ON s.id = m.supplier_id
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
              m.type, m.quantity AS cantidad, m.stock_after AS stock_final, m.reason AS motivo, u.name AS usuario,
              s.name AS proveedor, m.unit_cost AS costo_unitario,
              CASE WHEN m.unit_cost IS NOT NULL THEN m.quantity * m.unit_cost END AS valor
         FROM inventory_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN users u ON u.id = m.user_id
         LEFT JOIN suppliers s ON s.id = m.supplier_id
        WHERE ${where}
        ORDER BY m.created_at DESC, m.id DESC`
    )
    .all(...params)
    .map((m) => ({ ...m, tipo: TYPE_LABEL[m.type] || m.type }));

  const stock = db
    .prepare(
      `SELECT p.name AS producto, p.sku, p.category AS categoria, p.stock, p.min_stock AS minimo, p.cost AS costo, p.price AS precio,
              p.stock * p.cost AS valor_costo, p.stock * p.price AS valor_venta, s.name AS proveedor,
              CASE WHEN p.stock <= p.min_stock THEN 'Stock bajo' ELSE 'OK' END AS estado
         FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.business_id = ? AND p.active = 1 ORDER BY p.name`
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
        { header: 'Proveedor', key: 'proveedor', width: 24 },
        { header: 'Costo unitario', key: 'costo_unitario', type: 'money', width: 14 },
        { header: 'Valor de la compra', key: 'valor', type: 'money', width: 16 },
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
        { header: 'Proveedor', key: 'proveedor', width: 24 },
        { header: 'Stock', key: 'stock', type: 'integer', width: 10 },
        { header: 'Mínimo', key: 'minimo', type: 'integer', width: 10 },
        { header: 'Costo unit.', key: 'costo', type: 'money', width: 14 },
        { header: 'Precio unit.', key: 'precio', type: 'money', width: 14 },
        { header: 'Valor a costo', key: 'valor_costo', type: 'money', width: 16 },
        { header: 'Valor a precio', key: 'valor_venta', type: 'money', width: 16 },
        { header: 'Estado', key: 'estado', width: 12 },
      ],
      rows: stock,
      totals: ['stock', 'valor_costo', 'valor_venta'],
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

  // En las entradas (compras) se puede indicar el proveedor y el costo unitario
  let supplierId = null;
  let unitCost = null;
  if (type === 'entrada') {
    const sid = req.body.supplier_id;
    if (sid !== undefined && sid !== null && sid !== '') {
      const s = db.prepare('SELECT id FROM suppliers WHERE id = ? AND business_id = ?').get(sid, req.businessId);
      if (!s) return res.status(400).json({ error: 'Proveedor inválido' });
      supplierId = s.id;
    }
    const uc = req.body.unit_cost;
    if (uc !== undefined && uc !== null && uc !== '') {
      unitCost = toNum(uc, NaN);
      if (!Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: 'Costo unitario inválido' });
    }
  }

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
      `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason, supplier_id, unit_cost)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(req.businessId, p.id, req.user.id, type, delta, newStock, reason, supplierId, unitCost);
    // Opcional: actualizar el costo del producto y su proveedor habitual con los de esta compra
    if (type === 'entrada' && req.body.update_cost && unitCost !== null)
      db.prepare('UPDATE products SET cost = ? WHERE id = ?').run(unitCost, p.id);
    if (type === 'entrada' && supplierId && !p.supplier_id)
      db.prepare('UPDATE products SET supplier_id = ? WHERE id = ?').run(supplierId, p.id);
  })();
  res.status(201).json({ product_id: p.id, stock: newStock });
});

export default r;
