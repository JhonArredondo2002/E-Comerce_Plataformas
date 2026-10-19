import { Router } from 'express';
import db from '../db.js';
import { upload, fileUrl, removeUpload } from '../upload.js';
import { toBool, toNum } from '../utils.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();

function listProducts(req) {
  const q = `%${req.query.q || ''}%`;
  let sql = `SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
              WHERE p.business_id = ? AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)`;
  if (req.query.low === '1') sql += ' AND p.stock <= p.min_stock';
  if (req.query.active === '1') sql += ' AND p.active = 1';
  return db.prepare(sql + ' ORDER BY p.name').all(req.businessId, q, q, q);
}

r.get('/', (req, res) => res.json(listProducts(req)));

/** Exporta a Excel los productos (respeta la búsqueda) con su valor de inventario. */
r.get('/export', (req, res) => {
  const rows = listProducts(req).map((p) => ({
    ...p,
    margin: p.price > 0 ? (p.price - p.cost) / p.price : null,
    stock_cost: p.stock * p.cost,
    stock_value: p.stock * p.price,
    estado: p.active ? 'Activo' : 'Inactivo',
    catalogo: p.in_catalog ? 'Sí' : 'No',
    alerta: p.stock <= p.min_stock ? 'Stock bajo' : '',
  }));
  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.businessId);
  sendXlsx(res, `productos-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
    name: 'Productos',
    title: `${biz.name} · Productos`,
    columns: [
      { header: 'Producto', key: 'name', width: 32 },
      { header: 'SKU', key: 'sku', width: 14 },
      { header: 'Categoría', key: 'category', width: 18 },
      { header: 'Proveedor', key: 'supplier_name', width: 24 },
      { header: 'Precio de venta', key: 'price', type: 'money', width: 15 },
      { header: 'Costo', key: 'cost', type: 'money', width: 13 },
      { header: 'Margen', key: 'margin', type: 'percent', width: 10 },
      { header: 'Stock', key: 'stock', type: 'integer', width: 9 },
      { header: 'Stock mínimo', key: 'min_stock', type: 'integer', width: 10 },
      { header: 'Valor a costo', key: 'stock_cost', type: 'money', width: 15 },
      { header: 'Valor a precio de venta', key: 'stock_value', type: 'money', width: 16 },
      { header: 'En catálogo', key: 'catalogo', width: 11 },
      { header: 'Estado', key: 'estado', width: 10 },
      { header: 'Alerta', key: 'alerta', width: 12 },
    ],
    rows,
    totals: ['stock', 'stock_cost', 'stock_value'],
  }]);
});

/** Devuelve el id del proveedor si pertenece al negocio; null si viene vacío. Lanza error si es inválido. */
function supplierId(req, value) {
  if (value === undefined) return undefined;
  if (value === '' || value === null || value === 'null') return null;
  const s = db.prepare('SELECT id FROM suppliers WHERE id = ? AND business_id = ?').get(value, req.businessId);
  if (!s) throw Object.assign(new Error('Proveedor inválido'), { status: 400 });
  return s.id;
}

r.get('/categories', (req, res) => {
  res.json(
    db
      .prepare(`SELECT DISTINCT category FROM products WHERE business_id = ? AND category != '' ORDER BY category`)
      .all(req.businessId)
      .map((r) => r.category)
  );
});

r.post('/', upload.single('image'), (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const stock = Math.max(0, Math.trunc(toNum(b.stock)));
  let sup;
  try { sup = supplierId(req, b.supplier_id) ?? null; } catch (e) { return res.status(400).json({ error: e.message }); }
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO products (business_id, name, description, sku, category, price, cost, stock, min_stock, image, in_catalog, active, supplier_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        req.businessId, b.name, b.description || '', b.sku || '', b.category || '',
        toNum(b.price), toNum(b.cost), stock, Math.trunc(toNum(b.min_stock)),
        fileUrl(req.file) || '', toBool(b.in_catalog), toBool(b.active), sup
      );
    if (stock > 0)
      db.prepare(
        `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason, supplier_id, unit_cost)
         VALUES (?,?,?,'entrada',?,?,'Stock inicial',?,?)`
      ).run(req.businessId, info.lastInsertRowid, req.user.id, stock, stock, sup, toNum(b.cost));
    return info.lastInsertRowid;
  });
  const id = tx();
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

r.put('/:id', upload.single('image'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const b = req.body;
  if (b.name === '') return res.status(400).json({ error: 'El nombre es obligatorio' });
  let image = p.image;
  if (req.file) { removeUpload(p.image); image = fileUrl(req.file); }
  else if (b.remove_image === '1') { removeUpload(p.image); image = ''; }
  let sup;
  try { sup = supplierId(req, b.supplier_id); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (sup === undefined) sup = p.supplier_id;
  // El stock NO se edita aquí: se modifica con movimientos de inventario o ventas.
  db.prepare(
    `UPDATE products SET name=?, description=?, sku=?, category=?, price=?, cost=?, min_stock=?, image=?, in_catalog=?, active=?, supplier_id=? WHERE id=?`
  ).run(
    b.name ?? p.name, b.description ?? p.description, b.sku ?? p.sku, b.category ?? p.category,
    b.price !== undefined ? toNum(b.price) : p.price, b.cost !== undefined ? toNum(b.cost) : p.cost,
    b.min_stock !== undefined ? Math.trunc(toNum(b.min_stock)) : p.min_stock, image,
    toBool(b.in_catalog, p.in_catalog), toBool(b.active, p.active), sup, p.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id));
});

r.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND business_id = ?').get(req.params.id, req.businessId);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  db.prepare('DELETE FROM products WHERE id = ?').run(p.id);
  removeUpload(p.image);
  res.json({ ok: true });
});

export default r;
