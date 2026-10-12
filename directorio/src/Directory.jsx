import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BRAND } from '@shared/brand.js';
import { ThemeToggle } from '@shared/theme.jsx';
import DeveloperCredit from '@shared/DeveloperCredit.jsx';
import HeroSlider from '@shared/HeroSlider.jsx';
import { getJSON, img, storeUrl, waLink } from './api.js';

export default function Directory() {
  // Los filtros viven en la URL (?category=...&service=...&city=...&q=...) para poder compartir búsquedas.
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const service = params.get('service') || '';
  const city = params.get('city') || '';
  const q = params.get('q') || '';

  const [filters, setFilters] = useState({ categories: [], services: [], cities: [] });
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(q);

  const [featured, setFeatured] = useState([]);

  useEffect(() => { getJSON('/public/filters').then(setFilters).catch(() => {}); }, []);
  // Negocios aleatorios (con imagen) para el slider de fondo del encabezado
  useEffect(() => { getJSON('/public/featured?limit=8').then(setFeatured).catch(() => {}); }, []);
  const heroSlides = featured.map((b) => ({
    key: b.id,
    src: img(b.image),
    caption: `★ ${b.name}${b.category ? ` · ${b.category}` : ''}${b.city ? ` · ${b.city}` : ''}`,
    href: storeUrl(b.slug),
  }));

  useEffect(() => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (service) qs.set('service', service);
    if (city) qs.set('city', city);
    if (q) qs.set('q', q);
    setBusinesses(null);
    getJSON(`/public/businesses?${qs}`)
      .then((b) => { setBusinesses(b); setError(''); })
      .catch((e) => setError(e.message));
  }, [category, service, city, q]);

  // Búsqueda por texto con pequeño retraso
  useEffect(() => {
    const t = setTimeout(() => setParam('q', search.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key, value) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  const clear = () => { setSearch(''); setParams({}, { replace: true }); };
  const hasFilters = category || service || city || q;

  return (
    <div className="dir">
      <nav className="dir-nav">
        <a href="/" className="dir-logo"><img src={BRAND.logo} alt="" /> {BRAND.name}</a>
        <ThemeToggle />
      </nav>
      <HeroSlider className="dir-hero" slides={heroSlides} interval={5000}>
        <h1>Directorio de negocios</h1>
        <p>Encuentra negocios locales por categoría, servicio o ubicación</p>
        <input
          className="dir-search"
          placeholder="¿Qué estás buscando? Ej: café, reparación, domicilios…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </HeroSlider>

      <div className="dir-body">
        <aside className="dir-filters">
          <h3>Filtros</h3>
          <label>
            <span>Categoría</span>
            <select value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">Todas</option>
              {filters.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span>Servicio</span>
            <select value={service} onChange={(e) => setParam('service', e.target.value)}>
              <option value="">Todos</option>
              {filters.services.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span>Ubicación</span>
            <select value={city} onChange={(e) => setParam('city', e.target.value)}>
              <option value="">Todas</option>
              {filters.cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {hasFilters && <button className="clear" onClick={clear}>Limpiar filtros</button>}
        </aside>

        <main>
          {filters.categories.length > 0 && (
            <div className="pills">
              <button className={!category ? 'active' : ''} onClick={() => setParam('category', '')}>Todas</button>
              {filters.categories.map((c) => (
                <button key={c} className={category === c ? 'active' : ''} onClick={() => setParam('category', c)}>{c}</button>
              ))}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {!businesses && !error && <p className="muted">Cargando…</p>}
          {businesses && (
            <p className="muted count">{businesses.length} {businesses.length === 1 ? 'negocio encontrado' : 'negocios encontrados'}</p>
          )}
          {businesses?.length === 0 && (
            <div className="empty">No encontramos negocios con esos filtros. <button className="link" onClick={clear}>Ver todos</button></div>
          )}
          <div className="grid">
            {businesses?.map((b) => (
              <article key={b.id} className="biz" style={{ '--brand': b.primary_color || '#2563eb' }}>
                <a href={storeUrl(b.slug)} className="biz-cover" style={b.cover ? { backgroundImage: `url(${img(b.cover)})` } : undefined}>
                  {b.logo ? <img src={img(b.logo)} alt="" className="biz-logo" /> : <span className="biz-logo fallback">{b.name[0]}</span>}
                </a>
                <div className="biz-body">
                  <h2><a href={storeUrl(b.slug)}>{b.name}</a></h2>
                  <p className="biz-meta">
                    {b.category && <button className="tag" onClick={() => setParam('category', b.category)}>{b.category}</button>}
                    {b.city && <button className="tag loc" onClick={() => setParam('city', b.city)}>📍 {b.city}</button>}
                    {b.neighborhood && <span className="tag loc static">{b.neighborhood}</span>}
                  </p>
                  {b.description && <p className="biz-desc">{b.description}</p>}
                  {b.services.length > 0 && (
                    <div className="services">
                      {b.services.map((s) => (
                        <button key={s} className={`service ${service === s ? 'on' : ''}`} onClick={() => setParam('service', s)}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="biz-actions">
                  <a className="btn primary" href={storeUrl(b.slug)}>Ver tienda{b.products_count ? ` · ${b.products_count} productos` : ''}</a>
                  {b.whatsapp && <a className="btn wa" href={waLink(b.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp">WhatsApp</a>}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
      <footer className="dir-footer">
        <div className="dir-footer-inner">
          <div>
            <span className="dir-footer-brand"><img src={BRAND.logo} alt="" /> {BRAND.name}</span>
            <p>{BRAND.tagline}. © {new Date().getFullYear()}</p>
          </div>
          <DeveloperCredit showBrand={false} />
        </div>
      </footer>
    </div>
  );
}
