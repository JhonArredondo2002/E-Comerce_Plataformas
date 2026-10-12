// Bloque de "información del desarrollador" que se muestra en el footer de las 3 plataformas.
import { BRAND, DEVELOPER } from './brand.js';

const wa = (n) => `https://wa.me/${String(n).replace(/\D/g, '')}`;

export default function DeveloperCredit({ showBrand = true }) {
  const d = DEVELOPER;
  const links = [
    d.email && { href: `mailto:${d.email}`, label: d.email },
    d.whatsapp && { href: wa(d.whatsapp), label: `WhatsApp +${d.whatsapp}`, external: true },
    d.phone && { href: `tel:${d.phone}`, label: d.phone },
    d.website && { href: d.website, label: 'Sitio web', external: true },
    d.linkedin && { href: d.linkedin, label: 'LinkedIn', external: true },
    d.github && { href: d.github, label: 'GitHub', external: true },
    d.instagram && { href: d.instagram, label: 'Instagram', external: true },
  ].filter(Boolean);

  return (
    <div className="dev-credit">
      {showBrand && (
        <span className="dev-brand">
          <img src={BRAND.logo} alt="" width="20" height="20" /> {BRAND.name}
        </span>
      )}
      <span className="dev-text">
        Desarrollado por <strong>{d.name}</strong>{d.role ? ` · ${d.role}` : ''}
      </span>
      {links.length > 0 && (
        <span className="dev-links">
          {links.map((l) => (
            <a key={l.href} href={l.href} {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}>{l.label}</a>
          ))}
        </span>
      )}
    </div>
  );
}
