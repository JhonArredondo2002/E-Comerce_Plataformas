import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload, img } from '../api.js';

/** Carga datos de la API y expone reload. */
export function useLoad(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    return api(path)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

/** Selector de imagen con vista previa. value = ruta actual; onFile recibe el File elegido. */
export function ImageInput({ label = 'Imagen', value, onFile, onRemove }) {
  const [preview, setPreview] = useState('');
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const src = preview || img(value);
  return (
    <div className="field full">
      <span>{label}</span>
      <div className="image-input">
        {src ? <img src={src} alt="" /> : <div className="image-placeholder">Sin imagen</div>}
        <div className="image-actions">
          <label className="btn secondary small">
            Elegir imagen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setPreview(URL.createObjectURL(f)); onFile(f); }
              }}
            />
          </label>
          {src && onRemove && (
            <button type="button" className="btn ghost small" onClick={() => { setPreview(''); onFile(null); onRemove(); }}>
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const ErrorMsg = ({ children }) => (children ? <div className="alert error">{children}</div> : null);

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

export const Badge = ({ tone = 'gray', children }) => <span className={`badge ${tone}`}>{children}</span>;

/** Botón que descarga un archivo de Excel generado por el backend. */
export function ExportButton({ path, filename, label = 'Exportar a Excel', title }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await apiDownload(path, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn secondary" onClick={download} disabled={busy} title={title || 'Descarga en Excel la información que ves en pantalla (con los filtros aplicados)'}>
      {busy ? 'Generando…' : `⬇ ${label}`}
    </button>
  );
}
