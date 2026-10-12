import { Router } from 'express';
import db from '../db.js';
import { upload, fileUrl, removeUpload } from '../upload.js';
import { toBool, toNum } from '../utils.js';

const r = Router();

r.get('/', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  let sql = `SELECT * FROM products WHERE business_id = ? AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)`;
  if (req.query.low === '1') sql += ' AND stock <= min_stock';
  if (req.query.active === '1') sql += ' AND active = 1';
  res.json(db.prepare(sql + ' ORDER BY name').all(req.businessId, q, q, q));
});

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
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO products (business_id, name, description, sku, category, price, cost, stock, min_stock, image, in_catalog, active)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        req.businessId, b.name, b.description || '', b.sku || '', b.category || '',
        toNum(b.price), toNum(b.cost), stock, Math.trunc(toNum(b.min_stock)),
        fileUrl(req.file) || '', toBool(b.in_catalog), toBool(b.active)
      );
    if (stock > 0)
      db.prepare(
        `INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason)
         VALUES (?,?,?,'entrada',?,?,'Stock inicial')`
      ).run(req.businessId, info.lastInsertRowid, req.user.id, stock, stock);
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
  // El stock NO se edita aquí: se modifica con movimientos de inventario o ventas.
  db.prepare(
    `UPDATE products SET name=?, description=?, sku=?, category=?, price=?, cost=?, min_stock=?, image=?, in_catalog=?, active=? WHERE id=?`
  ).run(
    b.name ?? p.name, b.description ?? p.description, b.sku ?? p.sku, b.category ?? p.category,
    b.price !== undefined ? toNum(b.price) : p.price, b.cost !== undefined ? toNum(b.cost) : p.cost,
    b.min_stock !== undefined ? Math.trunc(toNum(b.min_stock)) : p.min_stock, image,
    toBool(b.in_catalog, p.in_catalog), toBool(b.active, p.active), p.id
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
