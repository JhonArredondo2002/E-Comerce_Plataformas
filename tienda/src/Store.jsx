import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BRAND, setFavicon } from '@shared/brand.js';
import { ThemeToggle } from '@shared/theme.jsx';
import DeveloperCredit from '@shared/DeveloperCredit.jsx';
import HeroSlider from '@shared/HeroSlider.jsx';
import { DIRECTORIO_URL, getJSON, img, money, waLink } from './api.js';
import {
  IconClock, IconFacebook, IconGlobe, IconInstagram, IconMail, IconPhone, IconPin, IconTikTok, IconWhatsApp,
} from './icons.jsx';

export default function Store() {
  const { slug } = useParams();
  const [biz, setBiz] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setBiz(null);
    setError(null);
    getJSON(`/public/businesses/${encodeURIComponent(slug)}`)
      .then((b) => {
        setBiz(b);
        document.title = b.name;
        setFavicon(b.logo ? img(b.logo) : BRAND.logo);
      })
      .catch((e) => setError(e));
  }, [slug]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const categories = useMemo(() => [...new Set((biz?.products || []).map((p) => p.category).filter(Boolean))], [biz]);
  const products = useMemo(
    () =>
      (biz?.products || []).filter(
        (p) => (!category || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase())
      ),
    [biz, category, q]
  );

  if (error)
    return (
      <div className="home">
        <h1>{error.status === 404 ? 'Negocio no encontrado' : 'No se pudo cargar la tienda'}</h1>
        <p>{error.message}</p>
        <a className="btn primary" href={DIRECTORIO_URL}>Ver el directorio de negocios</a>
      </div>
    );
  if (!biz) return <div className="loading">Cargando…</div>;

  const color = biz.primary_color || '#2563eb';
  // Slider del encabezado: imágenes subidas en Gestión; si no hay, se usa la portada.
  const heroSlides = (biz.slides || []).length
    ? biz.slides.map((sl) => ({ key: sl.id, src: img(sl.image), caption: sl.caption }))
    : biz.cover ? [{ key: 'cover', src: img(biz.cover) }] : [];
  const hasMap = biz.latitude != null && biz.longitude != null;
  const fullAddress = [biz.address, biz.neighborhood, biz.city].filter(Boolean).join(', ');
  const mapsHref = biz.maps_url || (hasMap ? `https://maps.google.com/?q=${biz.latitude},${biz.longitude}` : fullAddress ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}` : '');
  const mapEmbed = hasMap
    ? `https://maps.google.com/maps?q=${biz.latitude},${biz.longitude}&z=16&output=embed`
    : fullAddress ? `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=16&output=embed` : '';
  const socials = [
    biz.facebook && { href: biz.facebook, label: 'Facebook', Icon: IconFacebook },
    biz.instagram && { href: biz.instagram, label: 'Instagram', Icon: IconInstagram },
    biz.tiktok && { href: biz.tiktok, label: 'TikTok', Icon: IconTikTok },
    biz.website && { href: biz.website, label: 'Sitio web', Icon: IconGlobe },
  ].filter(Boolean);
  const channels = [
    biz.whatsapp && { href: waLink(biz.whatsapp), label: `WhatsApp +${biz.whatsapp}`, Icon: IconWhatsApp, external: true },
    biz.phone && { href: `tel:${biz.phone}`, label: biz.phone, Icon: IconPhone },
    biz.email && { href: `mailto:${biz.email}`, label: biz.email, Icon: IconMail },
  ].filter(Boolean);

  return (
    <div className="store" style={{ '--brand': color }}>
      <header className="store-nav">
        <a href="#inicio" className="store-brand">
          {biz.logo ? <img src={img(biz.logo)} alt="" /> : <span className="logo-fallback">{biz.name[0]}</span>}
          <span>{biz.name}</span>
        </a>
        <nav>
          {biz.ads.length > 0 && <a href="#anuncios">Novedades</a>}
          <a href="#catalogo">Catálogo</a>
          <a href="#contacto">Contacto</a>
          <ThemeToggle />
        </nav>
      </header>

      <HeroSlider id="inicio" className="hero" slides={heroSlides}>
        <div className="hero-inner">
          {biz.logo && <img className="hero-logo" src={img(biz.logo)} alt={biz.name} />}
          <h1>{biz.name}</h1>
          <p className="hero-meta">{[biz.category, biz.neighborhood, biz.city].filter(Boolean).join(' · ')}</p>
          {biz.description && <p className="hero-desc">{biz.description}</p>}
          {biz.services.length > 0 && (
            <div className="chips">{biz.services.map((s) => <span key={s} className="chip">{s}</span>)}</div>
          )}
          <div className="hero-actions">
            {biz.whatsapp && (
              <a className="btn wa" href={waLink(biz.whatsapp, `Hola ${biz.name}, vi su tienda y quiero más información.`)} target="_blank" rel="noreferrer">
                <IconWhatsApp /> Escríbenos
              </a>
            )}
            <a className="btn light" href="#catalogo">Ver catálogo</a>
          </div>
        </div>
      </HeroSlider>

      {biz.ads.length > 0 && (
        <section id="anuncios" className="section">
          <h2>Novedades y promociones</h2>
          <div className="ads">
            {biz.ads.map((a) => (
              <article key={a.id} className="ad">
                {a.image && <img src={img(a.image)} alt="" />}
                <div className="ad-text">
                  <h3>{a.title}</h3>
                  {a.content && <p>{a.content}</p>}
                  {a.ends_at && <small>Válido hasta {a.ends_at}</small>}
                  {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="ad-link">Ver más →</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="catalogo" className="section">
        <div className="section-head">
          <h2>Catálogo</h2>
          <input className="search" placeholder="Buscar en el catálogo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {categories.length > 1 && (
          <div className="filters">
            <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>Todos</button>
            {categories.map((c) => (
              <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        )}
        {!products.length && <p className="muted">No hay productos para mostrar.</p>}
        <div className="products">
          {products.map((p) => (
            <article key={p.id} className="product" onClick={() => setSelected(p)}>
              <div className="product-img">
                {p.image ? <img src={img(p.image)} alt={p.name} loading="lazy" /> : <span>{p.name[0]}</span>}
                {p.stock <= 0 && <span className="sold-out">Agotado</span>}
              </div>
              <div className="product-info">
                {p.category && <small>{p.category}</small>}
                <h3>{p.name}</h3>
                <strong>{money(p.price)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contacto" className="section contact">
        <div>
          <h2>Contacto y ubicación</h2>
          <ul className="contact-list">
            {channels.map(({ href, label, Icon, external }) => (
              <li key={href}><Icon /> <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{label}</a></li>
            ))}
            {fullAddress && (
              <li><IconPin /> {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer">{fullAddress}</a> : fullAddress}</li>
            )}
            {biz.schedule && <li><IconClock /> {biz.schedule}</li>}
          </ul>
          {socials.length > 0 && (
            <div className="socials">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon /></a>
              ))}
            </div>
          )}
        </div>
        {mapEmbed && <iframe className="map" title="Ubicación" src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
      </section>

      <footer className="store-footer">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-brand">
              {biz.logo ? <img src={img(biz.logo)} alt="" /> : <span className="logo-fallback">{biz.name[0]}</span>}
              <strong>{biz.name}</strong>
            </div>
            {biz.description && <p>{biz.description}</p>}
            {biz.category && <p className="muted">{biz.category}</p>}
          </div>
          <div className="footer-col">
            <h4>Contáctanos</h4>
            <ul>
              {channels.map(({ href, label, Icon, external }) => (
                <li key={href}><Icon width={16} height={16} /> <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{label}</a></li>
              ))}
              {!channels.length && <li className="muted">Sin canales registrados</li>}
            </ul>
          </div>
          <div className="footer-col">
            <h4>Visítanos</h4>
            <ul>
              {fullAddress && <li><IconPin width={16} height={16} /> {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer">{fullAddress}</a> : fullAddress}</li>}
              {biz.schedule && <li><IconClock width={16} height={16} /> {biz.schedule}</li>}
            </ul>
            {socials.length > 0 && (
              <div className="socials small">
                {socials.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon width={16} height={16} /></a>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {biz.name} · <a href={DIRECTORIO_URL}>Descubre más negocios en {BRAND.name} →</a></span>
          <DeveloperCredit />
        </div>
      </footer>

      {biz.whatsapp && (
        <a className="wa-float" href={waLink(biz.whatsapp, `Hola ${biz.name}, quiero más información.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp">
          <IconWhatsApp width={30} height={30} />
        </a>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setSelected(null)} aria-label="Cerrar">✕</button>
            {selected.image && <img src={img(selected.image)} alt={selected.name} />}
            <div className="modal-content">
              {selected.category && <small>{selected.category}</small>}
              <h3>{selected.name}</h3>
              <strong className="price">{money(selected.price)}</strong>
              {selected.description && <p>{selected.description}</p>}
              {selected.stock <= 0 && <p className="muted">Producto agotado por el momento.</p>}
              {biz.whatsapp && (
                <a className="btn wa block" target="_blank" rel="noreferrer"
                  href={waLink(biz.whatsapp, `Hola ${biz.name}, me interesa el producto "${selected.name}" (${money(selected.price)}). ¿Está disponible?`)}>
                  <IconWhatsApp /> Pedir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
