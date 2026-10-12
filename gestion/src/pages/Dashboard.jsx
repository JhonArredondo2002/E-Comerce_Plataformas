import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorMsg, PageHeader, useLoad } from '../components/ui.jsx';

function last7Days(rows) {
  const map = Object.fromEntries((rows || []).map((r) => [r.day, r.total]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, label: d.toLocaleDateString('es-CO', { weekday: 'short' }), total: map[key] || 0 };
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error } = useLoad('/dashboard');
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!data) return <p className="muted">Cargando…</p>;
  const days = last7Days(data.last7);
  const max = Math.max(...days.map((d) => d.total), 1);

  return (
    <>
      <PageHeader title={`Hola, ${user.name.split(' ')[0]}`} subtitle="Resumen de tu negocio">
        <Link to="/ventas/nueva" className="btn primary">+ Nueva venta</Link>
      </PageHeader>

      <div className="stats">
        <div className="stat"><small>Ventas hoy</small><strong>{money(data.salesToday.t)}</strong><span>{data.salesToday.n} ventas</span></div>
        <div className="stat"><small>Ventas del mes</small><strong>{money(data.salesMonth.t)}</strong><span>{data.salesMonth.n} ventas</span></div>
        <div className="stat"><small>Clientes</small><strong>{data.clients}</strong><span>registrados</span></div>
        <div className="stat"><small>Productos activos</small><strong>{data.products}</strong><span>Inventario: {money(data.inventoryValue)}</span></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Ventas últimos 7 días</h3>
          <div className="bars">
            {days.map((d) => (
              <div key={d.key} className="bar-col" title={money(d.total)}>
                <div className="bar" style={{ height: `${(d.total / max) * 100}%` }} />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Productos más vendidos</h3>
          {data.topProducts.length ? (
            <table className="table compact">
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td className="num">{p.qty} und</td><td className="num">{money(p.total)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Aún no hay ventas.</p>}
        </section>

        <section className="card">
          <h3>Stock bajo</h3>
          {data.lowStock.length ? (
            <table className="table compact">
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id}><td>{p.name}</td><td className="num danger-text">{p.stock} (mín. {p.min_stock})</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Todo el inventario está por encima del mínimo.</p>}
          <Link to="/inventario" className="link">Ir a inventario →</Link>
        </section>

        <section className="card">
          <h3>Tu presencia pública</h3>
          <p><strong>{data.activeAds}</strong> anuncios activos · <strong>{data.collaborators}</strong> colaboradores activos</p>
          <div className="row gap">
            <Link to="/anuncios" className="btn secondary small">Anuncios</Link>
            <Link to="/negocio" className="btn secondary small">Perfil del negocio</Link>
          </div>
        </section>
      </div>
    </>
  );
}
