import { BRAND } from '@shared/brand.js';
import DeveloperCredit from '@shared/DeveloperCredit.jsx';
import { DIRECTORIO_URL } from './api.js';

export default function Home() {
  return (
    <div className="home">
      <img src={BRAND.logo} alt={BRAND.name} width="64" height="64" />
      <h1>Tiendas {BRAND.name}</h1>
      <p>Para ver una tienda entra a <code>/nombre-del-negocio</code> o búscala en el directorio.</p>
      <a className="btn primary" href={DIRECTORIO_URL}>Ir al directorio de negocios</a>
      <footer className="home-footer"><DeveloperCredit /></footer>
    </div>
  );
}
