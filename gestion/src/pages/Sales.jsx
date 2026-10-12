import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dateTime, money } from '../api.js';
import { Badge, Empty, ErrorMsg, Modal, PageHeader, useLoad } from '../components/ui.jsx';

export default function Sales() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  const { data, error, reload } = useLoad(`/sales?${qs}`, [qs]);
  const [detail, setDetail] = useState(null);

  const completed = (data || []).filter((s) => s.status === 'completada');
  const total = completed.reduce((a, s) => a + s.total, 0);

  const open = async (s) => setDetail(await api(`/sales/${s.id}`));

  const cancel = async () => {
    if (!confirm(`¿Anular la venta #${detail.id}? El stock de los productos será devuelto.`)) return;
    try {
      await api(`/sales/${detail.id}/cancel`, { method: 'POST' });
      setDetail(null);
      reload();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Ventas" subtitle={`${completed.length} ventas · ${money(total)}`}>
        <Link className="btn primary" to="/ventas/nueva">+ Nueva venta</Link>
      </PageHeader>
      <div className="toolbar">
        <label className="inline">Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline">Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(from || to) && <button className="btn ghost small" onClick={() => { setFrom(''); setTo(''); }}>Limpiar</button>}
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>No hay ventas en este periodo.</Empty>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th className="num">Ítems</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => open(s)}>
                  <td>{s.id}</td>
                  <td>{dateTime(s.created_at)}</td>
                  <td>{s.client_name || <span className="muted">Consumidor final</span>}</td>
                  <td>{s.user_name}</td>
                  <td className="capitalize">{s.payment_method}</td>
                  <td className="num">{s.items_count}</td>
                  <td className="num">{money(s.total)}</td>
                  <td>{s.status === 'completada' ? <Badge tone="green">Completada</Badge> : <Badge tone="red">Anulada</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal title={`Venta #${detail.id}`} onClose={() => setDetail(null)}>
          <p className="muted">
            {dateTime(detail.created_at)} · Vendedor: {detail.user_name} · Pago: {detail.payment_method}
            <br />Cliente: {detail.client_name || 'Consumidor final'} {detail.client_document && `(${detail.client_document})`}
          </p>
          <table className="table compact">
            <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
            <tbody>
              {detail.items.map((i) => (
                <tr key={i.id}><td>{i.product_name}</td><td className="num">{i.quantity}</td><td className="num">{money(i.unit_price)}</td><td className="num">{money(i.subtotal)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}><strong>Total</strong></td><td className="num"><strong>{money(detail.total)}</strong></td></tr></tfoot>
          </table>
          {detail.notes && <p>Notas: {detail.notes}</p>}
          <div className="form-actions">
            {detail.status === 'completada' ? (
              <button className="btn danger" onClick={cancel}>Anular venta</button>
            ) : <Badge tone="red">Venta anulada</Badge>}
          </div>
        </Modal>
      )}
    </>
  );
}
