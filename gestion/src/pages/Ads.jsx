import { useState } from 'react';
import { api, img, toFormData } from '../api.js';
import { Badge, Empty, ErrorMsg, Field, ImageInput, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const EMPTY = { title: '', content: '', link: '', starts_at: '', ends_at: '', active: true };
const today = () => new Date().toISOString().slice(0, 10);

function status(a) {
  if (!a.active) return ['Inactivo', 'gray'];
  if (a.starts_at && a.starts_at > today()) return ['Programado', 'yellow'];
  if (a.ends_at && a.ends_at < today()) return ['Vencido', 'red'];
  return ['Publicado', 'green'];
}

export default function Ads() {
  const { data, error, reload } = useLoad('/ads');
  const [editing, setEditing] = useState(null);

  const remove = async (a) => {
    if (!confirm(`¿Eliminar el anuncio "${a.title}"?`)) return;
    try { await api(`/ads/${a.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Anuncios" subtitle="Los anuncios publicados aparecen en tu tienda pública">
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>+ Nuevo anuncio</button>
      </PageHeader>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>Aún no has creado anuncios.</Empty>}
      <div className="ads-grid">
        {data?.map((a) => {
          const [label, tone] = status(a);
          return (
            <article key={a.id} className="ad-card">
              {a.image ? <img src={img(a.image)} alt="" /> : <div className="ad-noimg">✦</div>}
              <div className="ad-body">
                <Badge tone={tone}>{label}</Badge>
                <h3>{a.title}</h3>
                <p>{a.content}</p>
                {(a.starts_at || a.ends_at) && (
                  <small className="muted">{a.starts_at || '…'} → {a.ends_at || 'sin fin'}</small>
                )}
              </div>
              <div className="ad-actions">
                <button className="btn ghost small" onClick={() => setEditing(a)}>Editar</button>
                <button className="btn ghost small danger" onClick={() => remove(a)}>Eliminar</button>
              </div>
            </article>
          );
        })}
      </div>
      {editing && <AdForm ad={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function AdForm({ ad, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...ad, starts_at: ad.starts_at || '', ends_at: ad.ends_at || '', active: !!ad.active });
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { title, content, link, starts_at, ends_at, active } = form;
      const fd = toFormData({ title, content, link, starts_at, ends_at, active });
      if (file) fd.append('image', file);
      if (removeImage && !file) fd.append('remove_image', '1');
      await api(ad.id ? `/ads/${ad.id}` : '/ads', { method: ad.id ? 'PUT' : 'POST', body: fd });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={ad.id ? 'Editar anuncio' : 'Nuevo anuncio'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={submit}>
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Título *" full><input value={form.title} onChange={set('title')} required /></Field>
        <Field label="Contenido" full><textarea rows={3} value={form.content} onChange={set('content')} /></Field>
        <Field label="Enlace (opcional)" full hint="Ej: enlace a una promoción o formulario"><input type="url" value={form.link} onChange={set('link')} /></Field>
        <Field label="Publicar desde" hint="Vacío = de inmediato"><input type="date" value={form.starts_at} onChange={set('starts_at')} /></Field>
        <Field label="Publicar hasta" hint="Vacío = sin fecha de fin"><input type="date" value={form.ends_at} onChange={set('ends_at')} /></Field>
        <ImageInput value={removeImage ? '' : ad.image} onFile={setFile} onRemove={() => setRemoveImage(true)} />
        <label className="check full"><input type="checkbox" checked={form.active} onChange={set('active')} /> Anuncio activo</label>
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}
