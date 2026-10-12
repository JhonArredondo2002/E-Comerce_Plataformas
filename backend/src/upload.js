import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (png, jpg, webp, gif)'));
  },
});

/** Devuelve la ruta pública del archivo subido o null. */
export const fileUrl = (file) => (file ? `/uploads/${file.filename}` : null);

/** Borra un archivo subido previamente (si existe). */
export function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const p = path.join(UPLOAD_DIR, path.basename(url));
  fs.rm(p, { force: true }, () => {});
}
