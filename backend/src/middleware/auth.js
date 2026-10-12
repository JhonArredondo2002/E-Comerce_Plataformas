import jwt from 'jsonwebtoken';
import db from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';

export function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
}

/**
 * Verifica el token y carga el usuario. Todas las consultas de la plataforma de
 * gestión usan req.businessId para que cada usuario solo vea los datos de su negocio.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.business_id, u.active,
                b.active AS business_active
           FROM users u LEFT JOIN businesses b ON b.id = u.business_id
          WHERE u.id = ?`
      )
      .get(id);
    if (!user || !user.active) return res.status(401).json({ error: 'Usuario inactivo o inexistente' });
    if (user.role !== 'superadmin' && !user.business_active)
      return res.status(403).json({ error: 'El negocio está desactivado' });
    req.user = user;
    req.businessId = user.business_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    next();
  };
}

/** Rutas de negocio: requieren que el usuario pertenezca a un negocio (admin o colaborador). */
export function requireBusiness(req, res, next) {
  if (!req.businessId) return res.status(403).json({ error: 'Esta sección es para usuarios de un negocio' });
  next();
}
