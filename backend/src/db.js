import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/plataforma.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS businesses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  city          TEXT DEFAULT '',
  neighborhood  TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  maps_url      TEXT DEFAULT '',
  latitude      REAL,
  longitude     REAL,
  phone         TEXT DEFAULT '',
  whatsapp      TEXT DEFAULT '',
  email         TEXT DEFAULT '',
  facebook      TEXT DEFAULT '',
  instagram     TEXT DEFAULT '',
  tiktok        TEXT DEFAULT '',
  website       TEXT DEFAULT '',
  schedule      TEXT DEFAULT '',
  logo          TEXT DEFAULT '',
  cover         TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#2563eb',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('superadmin','admin','colaborador')),
  position      TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  document    TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  sku         TEXT DEFAULT '',
  category    TEXT DEFAULT '',
  price       REAL NOT NULL DEFAULT 0,
  cost        REAL NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 0,
  image       TEXT DEFAULT '',
  in_catalog  INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste','venta','anulacion')),
  quantity    INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason      TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id    INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total          REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'efectivo',
  notes          TEXT DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'completada' CHECK (status IN ('completada','anulada')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity    INTEGER NOT NULL,
  unit_price  REAL NOT NULL,
  subtotal    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  link        TEXT DEFAULT '',
  starts_at   TEXT,
  ends_at     TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_ads_business ON ads(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business ON business_services(business_id);
CREATE INDEX IF NOT EXISTS idx_movements_business ON inventory_movements(business_id);
`);

// ── Migraciones para bases de datos creadas con versiones anteriores ──
function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing('businesses', 'neighborhood', "TEXT DEFAULT ''");

// Imágenes del slider del encabezado (hero) de la tienda pública
db.exec(`
CREATE TABLE IF NOT EXISTS business_slides (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image       TEXT NOT NULL,
  caption     TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_slides_business ON business_slides(business_id, sort_order);
`);

export default db;
