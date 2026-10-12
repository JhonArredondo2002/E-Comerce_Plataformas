import { api, TIENDA_URL } from '../api.js';
import { useAuth } from '../auth.jsx';
import BusinessForm, { businessFormData } from '../components/BusinessForm.jsx';
import { ErrorMsg, PageHeader, useLoad } from '../components/ui.jsx';
import SlidesManager from '../components/SlidesManager.jsx';

export default function BusinessProfile() {
  const { isAdmin, refresh } = useAuth();
  const { data, error, setData } = useLoad('/business');

  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!data) return <p className="muted">Cargando…</p>;

  const save = async (values, files) => {
    const { slug: _slug, ...rest } = values; // el slug lo administra el superadmin
    const updated = await api('/business', { method: 'PUT', body: businessFormData(rest, files) });
    setData(updated);
    refresh();
  };

  return (
    <>
      <PageHeader title="Mi negocio" subtitle="Esta información se muestra en tu tienda pública y en el directorio">
        <a className="btn secondary" href={`${TIENDA_URL}/${data.slug}`} target="_blank" rel="noreferrer">Ver tienda ↗</a>
      </PageHeader>
      <section className="card">
        {isAdmin ? (
          <BusinessForm key={data.id + (data.logo || '') + (data.cover || '')} initial={data} onSubmit={save} />
        ) : (
          <>
            <div className="alert info">Solo un administrador puede editar el perfil del negocio.</div>
            <dl className="details">
              <dt>Nombre</dt><dd>{data.name}</dd>
              <dt>Categoría</dt><dd>{data.category}</dd>
              <dt>Servicios</dt><dd>{data.services.join(', ')}</dd>
              <dt>Ciudad</dt><dd>{data.city}</dd>
              <dt>Barrio</dt><dd>{data.neighborhood}</dd>
              <dt>Dirección</dt><dd>{data.address}</dd>
              <dt>WhatsApp</dt><dd>{data.whatsapp}</dd>
              <dt>Horario</dt><dd>{data.schedule}</dd>
            </dl>
          </>
        )}
      </section>
      <SlidesManager canEdit={isAdmin} seconds={data.slider_seconds} />
    </>
  );
}
