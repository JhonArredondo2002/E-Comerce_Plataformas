import { useState } from 'react';
import { api, dateTime, money } from '../api.js';
import { Empty, ErrorMsg, ExportButton, Field, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const EMPTY = { name: '', document: '', phone: '', email: '', address: '', notes: '' };

export default function Clients() {
  const [q, setQ] = useState('');
  const { data, error, reload } = useLoad(`/clients?q=${encodeURIComponent(q)}`, [q]);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const remove = async (c) => {
    if (!confirm(`¿Eliminar al cliente "${c.name}"?`)) return;
    try { await api(`/clients/${c.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  const openDetail = async (c) => setDetail(await api(`/clients/${c.id}`));

  return (
    <>
      <PageHeader title="Clientes" subtitle="Base de clientes de tu negocio">
        <ExportButton path={`/clients/export?q=${encodeURIComponent(q)}`} filename="clientes" />
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>+ Nuevo cliente</button>
      </PageHeader>
      <div className="toolbar">
        <input className="search" placeholder="Buscar por nombre, documento, teléfono o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>No hay clientes registrados.</Empty>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Correo</th><th className="num">Compras</th><th className="num">Total</th><th /></tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><button className="link" onClick={() => openDetail(c)}>{c.name}</button></td>
                  <td>{c.document}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td className="num">{c.purchases}</td>
                  <td className="num">{money(c.total_spent)}</td>
                  <td className="actions-cell">
                    <button className="btn ghost small" onClick={() => setEditing(c)}>Editar</button>
                    <button className="btn ghost small danger" onClick={() => remove(c)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ClientForm client={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <p className="muted">{[detail.document, detail.phone, detail.email, detail.address].filter(Boolean).join(' · ')}</p>
          {detail.notes && <p>{detail.notes}</p>}
          <h4>Historial de compras</h4>
          {detail.sales.length ? (
            <table className="table compact">
              <tbody>
                {detail.sales.map((s) => (
                  <tr key={s.id} className={s.status === 'anulada' ? 'muted strike' : ''}>
                    <td>#{s.id}</td><td>{dateTime(s.created_at)}</td><td>{s.payment_method}</td><td className="num">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Sin compras.</p>}
        </Modal>
      )}
    </>
  );
}

export function ClientForm({ client, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...client });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const saved = client.id
        ? await api(`/clients/${client.id}`, { method: 'PUT', body: form })
        : await api('/clients', { method: 'POST', body: form });
      onSaved(saved);
    } catch (err) { setError(err.message); }
  };

  return (
    <Modal title={client.id ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Nombre *" full><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Documento"><input value={form.document} onChange={set('document')} /></Field>
        <Field label="Teléfono"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Correo"><input type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Dirección"><input value={form.address} onChange={set('address')} /></Field>
        <Field label="Notas" full><textarea rows={3} value={form.notes} onChange={set('notes')} /></Field>
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
