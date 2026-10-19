import { Router } from 'express';
import db from '../db.js';
import { toNum } from '../utils.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();

function salesFilter(req) {
  const params = [req.businessId];
  let where = 's.business_id = ?';
  if (req.query.from) { where += " AND date(s.created_at, 'localtime') >= date(?)"; params.push(req.query.from); }
  if (req.query.to) { where += " AND date(s.created_at, 'localtime') <= date(?)"; params.push(req.query.to); }
  if (req.query.status) { where += ' AND s.status = ?'; params.push(req.query.status); }
  return { where, params };
}

r.get('/', (req, res) => {
  const { where, params } = salesFilter(req);
  const rows = db
    .prepare(
      `SELECT s.*, c.name AS client_name, u.name AS user_name,
              (SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = s.id) AS items_count
         FROM sales s
         LEFT JOIN clients c ON c.id = s.client_id
         LEFT JOIN users u ON u.id = s.user_id
        WHERE ${where}
        ORDER BY s.created_at DESC, s.id DESC LIMIT 500`
    )
    .all(...params);
  res.json(rows);
});

/**
 * Exporta las ventas del periodo filtrado: hoja "Ventas" (una fila por venta),
 * hoja "Detalle" (una fila por producto vendido) y hoja "Por producto" (resumen).
 */
r.get('/export', (req, res) => {
  const { where, params } = salesFilter(req);
  const sales = db
    .prepare(
      `SELECT s.id, datetime(s.created_at, 'localtime') AS fecha, COALESCE(c.name, 'Consumidor final') AS cliente,
              c.document AS documento, u.name AS vendedor, s.payment_method AS pago, s.status AS estado, s.notes AS notas,
              (SELECT SUM(i.quantity) FROM sale_items i WHERE i.sale_id = s.id) AS unidades,
              CASE WHEN s.status = 'completada' THEN s.total ELSE 0 END AS total_valido, s.total
         FROM sales s LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.user_id
        WHERE ${where} ORDER BY s.created_at DESC, s.id DESC`
    )
    .all(...params)
    .map((v) => ({ ...v, estado: v.estado === 'completada' ? 'Completada' : 'Anulada' }));
  const items = db
    .prepare(
      `SELECT s.id AS venta, datetime(s.created_at, 'localtime') AS fecha, i.product_name AS producto, p.sku, p.category AS categoria,
              i.quantity AS cantidad, i.unit_price AS precio, i.subtotal, p.cost AS costo_actual,
              CASE WHEN p.cost IS NOT NULL THEN i.subtotal - i.quantity * p.cost END AS utilidad, s.status AS estado
         FROM sale_items i JOIN sales s ON s.id = i.sale_id LEFT JOIN products p ON p.id = i.product_id
        WHERE ${where} ORDER BY s.created_at DESC, s.id DESC, i.id`
    )
    .all(...params)
    .map((v) => ({ ...v, estado: v.estado === 'completada' ? 'Completada' : 'Anulada' }));
  const byProduct = db
    .prepare(
      `SELECT i.product_name AS producto, SUM(i.quantity) AS unidades, SUM(i.subtotal) AS ventas, COUNT(DISTINCT s.id) AS num_ventas
         FROM sale_items i JOIN sales s ON s.id = i.sale_id
        WHERE ${where} AND s.status = 'completada'
        GROUP BY i.product_name ORDER BY ventas DESC`
    )
    .all(...params);

  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.businessId);
  const { from, to } = req.query;
  const period = from || to ? ` (${from || 'inicio'} a ${to || 'hoy'})` : '';
  sendXlsx(res, `ventas-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    {
      name: 'Ventas',
      title: `${biz.name} · Ventas${period}`,
      columns: [
        { header: 'N.° venta', key: 'id', type: 'integer', width: 10 },
        { header: 'Fecha', key: 'fecha', type: 'datetime', width: 18 },
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Vendedor', key: 'vendedor', width: 22 },
        { header: 'Método de pago', key: 'pago', width: 15 },
        { header: 'Unidades', key: 'unidades', type: 'integer', width: 10 },
        { header: 'Total', key: 'total', type: 'money', width: 15 },
        { header: 'Total válido (sin anuladas)', key: 'total_valido', type: 'money', width: 18 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'Notas', key: 'notas', width: 28 },
      ],
      rows: sales,
      totals: ['unidades', 'total_valido'],
    },
    {
      name: 'Detalle',
      title: `${biz.name} · Detalle de productos vendidos${period}`,
      columns: [
        { header: 'N.° venta', key: 'venta', type: 'integer', width: 10 },
        { header: 'Fecha', key: 'fecha', type: 'datetime', width: 18 },
        { header: 'Producto', key: 'producto', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Cantidad', key: 'cantidad', type: 'integer', width: 10 },
        { header: 'Precio unitario', key: 'precio', type: 'money', width: 15 },
        { header: 'Subtotal', key: 'subtotal', type: 'money', width: 15 },
        { header: 'Utilidad estimada (costo actual)', key: 'utilidad', type: 'money', width: 20 },
        { header: 'Estado de la venta', key: 'estado', width: 14 },
      ],
      rows: items,
    },
    {
      name: 'Por producto',
      title: `${biz.name} · Ventas por producto${period} (sin anuladas)`,
      columns: [
        { header: 'Producto', key: 'producto', width: 32 },
        { header: 'Unidades vendidas', key: 'unidades', type: 'integer', width: 14 },
        { header: 'Número de ventas', key: 'num_ventas', type: 'integer', width: 14 },
        { header: 'Valor vendido', key: 'ventas', type: 'money', width: 16 },
      ],
      rows: byProduct,
      totals: ['unidades', 'ventas'],
    },
  ]);
});

r.get('/:id', (req, res) => {
  const s = db
    .prepare(
      `SELECT s.*, c.name AS client_name, c.document AS client_document, c.phone AS client_phone, u.name AS user_name
         FROM sales s LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.business_id = ?`
    )
    .get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Venta no encontrada' });
  s.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id);
  res.json(s);
});

/** Crea una venta: valida stock, descuenta inventario y registra movimientos en una transacción. */
r.post('/', (req, res) => {
  const { client_id = null, payment_method = 'efectivo', notes = '', items = [] } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
  if (client_id && !db.prepare('SELECT id FROM clients WHERE id = ? AND business_id = ?').get(client_id, req.businessId))
    return res.status(400).json({ error: 'Cliente inválido' });

  try {
    const saleId = db.transaction(() => {
      const lines = items.map((it) => {
        const qty = Math.trunc(toNum(it.quantity));
        if (qty <= 0) throw new Error('Cantidad inválida');
        const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(it.product_id, req.businessId);
        if (!p) throw new Error('Producto no encontrado');
        if (p.stock < qty) throw new Error(`Stock insuficiente para "${p.name}" (disponible: ${p.stock})`);
        const unit = it.unit_price !== undefined ? toNum(it.unit_price) : p.price;
        return { p, qty, unit, subtotal: unit * qty };
      });
      const total = lines.reduce((a, l) => a + l.subtotal, 0);
      const info = db
        .prepare('INSERT INTO sales (business_id, client_id, user_id, total, payment_method, notes) VALUES (?,?,?,?,?,?)')
        .run(req.businessId, client_id || null, req.user.id, total, payment_method, notes);
      const id = info.lastInsertRowid;
      for (const l of lines) {
        db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)')
          .run(id, l.p.id, l.p.name, l.qty, l.unit, l.subtotal);
        const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(l.p.id).stock - l.qty;
        if (stock < 0) throw new Error(`Stock insuficiente para "${l.p.name}"`);
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, l.p.id);
        db.prepare(
          `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason) VALUES (?,?,?,'venta',?,?,?)`
        ).run(req.businessId, l.p.id, req.user.id, -l.qty, stock, `Venta #${id}`);
      }
      return id;
    })();
    res.status(201).json({ id: saleId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Anula una venta y devuelve el stock. */
r.post('/:id/cancel', (req, res) => {
  const s = db.prepare('SELECT * FROM sales WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!s) return res.status(404).json({ error: 'Venta no encontrada' });
  if (s.status === 'anulada') return res.status(400).json({ error: 'La venta ya está anulada' });
  db.transaction(() => {
    db.prepare(`UPDATE sales SET status = 'anulada' WHERE id = ?`).run(s.id);
    for (const it of db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id)) {
      const p = it.product_id && db.prepare('SELECT stock FROM products WHERE id = ?').get(it.product_id);
      if (!p) continue;
      const stock = p.stock + it.quantity;
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, it.product_id);
      db.prepare(
        `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason) VALUES (?,?,?,'anulacion',?,?,?)`
      ).run(req.businessId, it.product_id, req.user.id, it.quantity, stock, `Anulación venta #${s.id}`);
    }
  })();
  res.json({ ok: true });
});

export default r;
