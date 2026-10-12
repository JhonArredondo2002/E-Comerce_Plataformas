import { useState } from 'react';
import { ErrorMsg, Field, ImageInput } from './ui.jsx';

export const BUSINESS_EMPTY = {
  name: '', slug: '', description: '', category: '', city: '', neighborhood: '', address: '', maps_url: '', latitude: '', longitude: '',
  phone: '', whatsapp: '', email: '', facebook: '', instagram: '', tiktok: '', website: '', schedule: '',
  primary_color: '#2563eb', services: [],
};

export const CATEGORY_SUGGESTIONS = [
  'Restaurantes y cafés', 'Tecnología', 'Moda y accesorios', 'Salud y belleza', 'Hogar y ferretería',
  'Supermercados', 'Servicios profesionales', 'Mascotas', 'Educación', 'Deportes', 'Automotriz',
];

/**
 * Formulario reutilizable del perfil público de un negocio.
 * onSubmit recibe ({ ...campos, services: [] }, { logo, cover }).
 */
export default function BusinessForm({ initial, onSubmit, submitLabel = 'Guardar', showSlug = false, extra = null, onCancel }) {
  const [form, setForm] = useState({
    ...BUSINESS_EMPTY,
    ...initial,
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
  });
  const [servicesText, setServicesText] = useState((initial?.services || []).join(', '));
  const [logo, setLogo] = useState(null);
  const [cover, setCover] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setOk(false);
    try {
      const services = servicesText.split(',').map((s) => s.trim()).filter(Boolean);
      await onSubmit({ ...form, services }, { logo, cover });
      setOk(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <ErrorMsg>{error}</ErrorMsg>
      {ok && <div className="alert success full">Cambios guardados.</div>}

      <h4 className="full section-title">Información general</h4>
      <Field label="Nombre del negocio *"><input value={form.name} onChange={set('name')} required /></Field>
      {showSlug && (
        <Field label="Identificador en la URL" hint="Se genera del nombre si lo dejas vacío. Ej: mi-negocio">
          <input value={form.slug} onChange={set('slug')} pattern="[a-z0-9-]*" />
        </Field>
      )}
      <Field label="Categoría">
        <input list="biz-categories" value={form.category} onChange={set('category')} />
        <datalist id="biz-categories">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Servicios que ofrece" hint="Separados por coma: Domicilios, Reparación, Wifi…" full>
        <input value={servicesText} onChange={(e) => setServicesText(e.target.value)} />
      </Field>
      <Field label="Descripción" full><textarea rows={3} value={form.description} onChange={set('description')} /></Field>
      <Field label="Horario de atención"><input value={form.schedule} onChange={set('schedule')} placeholder="Lun a Sáb 8:00 a.m. – 6:00 p.m." /></Field>
      <Field label="Color principal de la tienda"><input type="color" value={form.primary_color || '#2563eb'} onChange={set('primary_color')} /></Field>
      <ImageInput label="Logo" value={initial?.logo} onFile={setLogo} />
      <ImageInput label="Imagen de portada" value={initial?.cover} onFile={setCover} />

      <h4 className="full section-title">Ubicación</h4>
      <Field label="Ciudad"><input value={form.city} onChange={set('city')} /></Field>
      <Field label="Barrio"><input value={form.neighborhood || ''} onChange={set('neighborhood')} /></Field>
      <Field label="Dirección" full><input value={form.address} onChange={set('address')} /></Field>
      <Field label="Enlace de Google Maps" full><input type="url" value={form.maps_url} onChange={set('maps_url')} placeholder="https://maps.google.com/…" /></Field>
      <Field label="Latitud" hint="Opcional, para mostrar el mapa"><input type="number" step="any" value={form.latitude} onChange={set('latitude')} /></Field>
      <Field label="Longitud"><input type="number" step="any" value={form.longitude} onChange={set('longitude')} /></Field>

      <h4 className="full section-title">Contacto y redes sociales</h4>
      <Field label="WhatsApp" hint="Con indicativo de país, sin + ni espacios. Ej: 573001234567"><input value={form.whatsapp} onChange={set('whatsapp')} /></Field>
      <Field label="Teléfono"><input value={form.phone} onChange={set('phone')} /></Field>
      <Field label="Correo"><input type="email" value={form.email} onChange={set('email')} /></Field>
      <Field label="Sitio web"><input type="url" value={form.website} onChange={set('website')} /></Field>
      <Field label="Facebook (URL)"><input type="url" value={form.facebook} onChange={set('facebook')} /></Field>
      <Field label="Instagram (URL)"><input type="url" value={form.instagram} onChange={set('instagram')} /></Field>
      <Field label="TikTok (URL)"><input type="url" value={form.tiktok} onChange={set('tiktok')} /></Field>

      {extra}

      <div className="form-actions full">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>}
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
      </div>
    </form>
  );
}

/** Convierte el formulario a FormData para enviarlo al backend. */
export function businessFormData(values, files, extraFields = {}) {
  const fd = new FormData();
  const { services, ...rest } = { ...values, ...extraFields };
  const skip = ['id', 'logo', 'cover', 'active', 'created_at', 'users', 'users_count', 'products_count'];
  Object.entries(rest).forEach(([k, v]) => {
    if (skip.includes(k) || v === undefined || v === null) return;
    fd.append(k, v);
  });
  fd.append('services', JSON.stringify(services || []));
  if (files.logo) fd.append('logo', files.logo);
  if (files.cover) fd.append('cover', files.cover);
  return fd;
}
