import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { UPLOAD_DIR } from './upload.js';
import { requireAuth, requireBusiness } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import businessAdminRoutes from './routes/businessAdmin.js';
import businessRoutes from './routes/business.js';
import usersRoutes from './routes/users.js';
import clientsRoutes from './routes/clients.js';
import productsRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import salesRoutes from './routes/sales.js';
import adsRoutes from './routes/ads.js';
import dashboardRoutes from './routes/dashboard.js';
import publicRoutes from './routes/public.js';

const app = express();
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Pública (Tienda y Directorio)
app.use('/api/public', publicRoutes);

// Autenticación
app.use('/api/auth', authRoutes);

// Superadmin de la plataforma
app.use('/api/admin/businesses', requireAuth, businessAdminRoutes);

// Gestión (datos aislados por negocio)
const biz = [requireAuth, requireBusiness];
app.use('/api/business', ...biz, businessRoutes);
app.use('/api/users', ...biz, usersRoutes);
app.use('/api/clients', ...biz, clientsRoutes);
app.use('/api/products', ...biz, productsRoutes);
app.use('/api/inventory', ...biz, inventoryRoutes);
app.use('/api/sales', ...biz, salesRoutes);
app.use('/api/ads', ...biz, adsRoutes);
app.use('/api/dashboard', ...biz, dashboardRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejo de errores (incluye errores de multer)
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('imágenes') ? 400 : 500);
  res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera 5 MB' : err.message || 'Error interno' });
});

// Crea un superadmin por defecto si no existe ninguno
if (!db.prepare(`SELECT id FROM users WHERE role = 'superadmin'`).get()) {
  db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'superadmin')`).run(
    'Super Administrador', 'super@plataforma.com', bcrypt.hashSync('super123', 10)
  );
  console.log('Superadmin creado: super@plataforma.com / super123  (¡cambia la contraseña!)');
}

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
