import { useRef, useState } from 'react';
import { api, img } from '../api.js';
import { ErrorMsg, useLoad } from './ui.jsx';

const MAX = 10;

/** Administra las imágenes del slider del encabezado de la tienda pública. */
export default function SlidesManager({ canEdit }) {
  const { data: slides, setData, error } = useLoad('/business/slides');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);

  const run = async (fn) => {
    setBusy(true); setMsg('');
    try { setData(await fn()); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const upload = (files) => {
    if (!files?.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    run(() => api('/business/slides', { method: 'POST', body: fd }));
    if (inputRef.current) inputRef.current.value = '';
  };
  const move = (s, dir) => run(() => api(`/business/slides/${s.id}`, { method: 'PUT', body: { move: dir } }));
  const caption = (s, text) => {
    if (text === s.caption) return;
    run(() => api(`/business/slides/${s.id}`, { method: 'PUT', body: { caption: text } }));
  };
  const remove = (s) => {
    if (!confirm('¿Quitar esta imagen del slider?')) return;
    run(() => api(`/business/slides/${s.id}`, { method: 'DELETE' }));
  };

  const full = (slides?.length || 0) >= MAX;

  return (
    <section className="card slides-card">
      <div className="slides-head">
        <div>
          <h3>Slider de la tienda</h3>
          <p className="muted small">
            Imágenes que rotan de fondo en el encabezado de tu tienda pública ({slides?.length || 0}/{MAX}).
            Recomendado: horizontales, mínimo 1600×900 px. Si no subes ninguna se usa la imagen de portada.
          </p>
        </div>
        {canEdit && (
          <label className={`btn primary ${busy || full ? 'disabled' : ''}`}>
            {busy ? 'Subiendo…' : '+ Agregar imágenes'}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              hidden
              disabled={busy || full}
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        )}
      </div>
      <ErrorMsg>{error || msg}</ErrorMsg>
      {slides && !slides.length && <div className="empty small-empty">Aún no hay imágenes en el slider.</div>}
      <div className="slides-grid">
        {slides?.map((s, i) => (
          <figure key={s.id} className="slide-item">
            <img src={img(s.image)} alt="" />
            <span className="slide-num">{i + 1}</span>
            {canEdit ? (
              <figcaption>
                <input
                  defaultValue={s.caption}
                  placeholder="Texto opcional sobre la imagen"
                  maxLength={80}
                  onBlur={(e) => caption(s, e.target.value)}
                />
                <div className="slide-actions">
                  <button type="button" className="icon-btn" disabled={busy || i === 0} onClick={() => move(s, 'up')} aria-label="Mover antes">←</button>
                  <button type="button" className="icon-btn" disabled={busy || i === slides.length - 1} onClick={() => move(s, 'down')} aria-label="Mover después">→</button>
                  <span className="spacer" />
                  <button type="button" className="btn ghost small danger" disabled={busy} onClick={() => remove(s)}>Quitar</button>
                </div>
              </figcaption>
            ) : s.caption ? <figcaption className="muted small">{s.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
