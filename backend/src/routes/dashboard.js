import { Router } from 'express';
import db from '../db.js';

const r = Router();

r.get('/', (req, res) => {
  const id = req.businessId;
  const one = (sql, ...p) => db.prepare(sql).get(id, ...p);
  const today = one(`SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM sales WHERE business_id=? AND status='completada' AND date(created_at, 'localtime') = date('now','localtime')`);
  const month = one(`SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM sales WHERE business_id=? AND status='completada' AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m','now','localtime')`);
  const last7 = db
    .prepare(
      `SELECT date(created_at,'localtime') AS day, COALESCE(SUM(total),0) AS total, COUNT(*) AS count
         FROM sales WHERE business_id=? AND status='completada' AND date(created_at,'localtime') >= date('now','localtime','-6 days')
        GROUP BY day ORDER BY day`
    )
    .all(id);
  const topProducts = db
    .prepare(
      `SELECT i.product_name AS name, SUM(i.quantity) AS qty, SUM(i.subtotal) AS total
         FROM sale_items i JOIN sales s ON s.id = i.sale_id
        WHERE s.business_id=? AND s.status='completada'
        GROUP BY i.product_name ORDER BY qty DESC LIMIT 5`
    )
    .all(id);
  const lowStock = db
    .prepare('SELECT id, name, stock, min_stock FROM products WHERE business_id=? AND active=1 AND stock <= min_stock ORDER BY stock LIMIT 10')
    .all(id);
  res.json({
    salesToday: today,
    salesMonth: month,
    clients: one('SELECT COUNT(*) n FROM clients WHERE business_id=?').n,
    products: one('SELECT COUNT(*) n FROM products WHERE business_id=? AND active=1').n,
    inventoryValue: one('SELECT COALESCE(SUM(stock*cost),0) v FROM products WHERE business_id=? AND active=1').v,
    activeAds: one(`SELECT COUNT(*) n FROM ads WHERE business_id=? AND active=1`).n,
    collaborators: one('SELECT COUNT(*) n FROM users WHERE business_id=? AND active=1').n,
    last7,
    topProducts,
    lowStock,
  });
});

export default r;
