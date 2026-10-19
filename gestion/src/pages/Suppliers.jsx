import { useState } from 'react';
import { api, dateTime, money } from '../api.js';
import { Badge, Empty, ErrorMsg, ExportButton, Field, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const EMPTY = { name: '', document: '', contact_name: '', phone: '', email: '', address: '', supplies: '', notes: '', active: true };
const waLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, '').replace(/^(?=3\d{9}$)/, '57')}`;

export default function Suppliers() {
  const [q, setQ] = useState('');
  const { data, error, reload } = useLoad(`/suppliers?q=${encodeURIComponent(q)}`, [q]);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const remove = async (s) => {
    if (!confirm(`¿Eliminar al proveedor "${s.name}"? Sus productos y compras registradas se conservan, pero quedarán sin proveedor.`)) return;
    try { await api(`/suppliers/${s.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  const openDetail = async (s) => {
    try { setDetail(await api(`/suppliers/${s.id}`)); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Proveedores" subtitle="Empresas o personas a las que tu negocio les compra mercancía">
        <ExportButton path={`/suppliers/export?q=${encodeURIComponent(q)}`} filename="proveedores" />
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>+ Nuevo proveedor</button>
      </PageHeader>
      <div className="toolbar">
        <input className="search" placeholder="Buscar por nombre, NIT, contacto o lo que suministra…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>No hay proveedores registrados.</Empty>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Suministra</th><th className="num">Productos</th><th className="num">Comprado</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="link" onClick={() => openDetail(s)}><strong>{s.name}</strong></button>
                    {s.document && <div className="muted small">NIT {s.document}</div>}
                  </td>
                  <td>{s.contact_name}</td>
                  <td>{s.phone && <a href={waLink(s.phone)} target="_blank" rel="noreferrer">{s.phone}</a>}</td>
                  <td>{s.supplies}</td>
                  <td className="num">{s.products_count}</td>
                  <td className="num">{money(s.purchases_total)}</td>
                  <td>{s.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  <td className="actions-cell">
                    <button className="btn ghost small" onClick={() => setEditing(s)}>Editar</button>
                    <button className="btn ghost small danger" onClick={() => remove(s)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <SupplierForm supplier={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <dl className="details">
            {detail.document && <><dt>NIT / Documento</dt><dd>{detail.document}</dd></>}
            {detail.contact_name && <><dt>Contacto</dt><dd>{detail.contact_name}</dd></>}
            {detail.phone && <><dt>Teléfono</dt><dd><a href={waLink(detail.phone)} target="_blank" rel="noreferrer">{detail.phone}</a> (WhatsApp)</dd></>}
            {detail.email && <><dt>Correo</dt><dd><a href={`mailto:${detail.email}`}>{detail.email}</a></dd></>}
            {detail.address && <><dt>Dirección</dt><dd>{detail.address}</dd></>}
            {detail.supplies && <><dt>Suministra</dt><dd>{detail.supplies}</dd></>}
            {detail.notes && <><dt>Notas</dt><dd>{detail.notes}</dd></>}
          </dl>

          <h4>Productos que suministra ({detail.products.length})</h4>
          {detail.products.length ? (
            <table className="table compact">
              <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Costo</th></tr></thead>
              <tbody>
                {detail.products.map((p) => (
                  <tr key={p.id}><td>{p.name}{p.sku && <span className="muted small"> · {p.sku}</span>}</td><td className="num">{p.stock}</td><td className="num">{money(p.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Ningún producto tiene asignado este proveedor. Puedes asignarlo al editar un producto.</p>}

          <h4>Últimas compras</h4>
          {detail.purchases.length ? (
            <table className="table compact">
              <thead><tr><th>Fecha</th><th>Producto</th><th className="num">Cant.</th><th className="num">Costo unit.</th><th className="num">Total</th></tr></thead>
              <tbody>
                {detail.purchases.map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.created_at)}</td><td>{m.product_name}</td><td className="num">{m.quantity}</td>
                    <td className="num">{m.unit_cost != null ? money(m.unit_cost) : '—'}</td>
                    <td className="num">{m.unit_cost != null ? money(m.unit_cost * m.quantity) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Aún no hay compras registradas. Se registran desde Inventario → “Registrar movimiento” → Entrada.</p>}
        </Modal>
      )}
    </>
  );
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...supplier, active: supplier.active === undefined ? true : !!supplier.active });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, form[k]]));
      await api(supplier.id ? `/suppliers/${supplier.id}` : '/suppliers', { method: supplier.id ? 'PUT' : 'POST', body });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={supplier.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={submit}>
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Nombre o razón social *" full><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="NIT / Documento"><input value={form.document} onChange={set('document')} /></Field>
        <Field label="Persona de contacto"><input value={form.contact_name} onChange={set('contact_name')} /></Field>
        <Field label="Teléfono / WhatsApp"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Correo"><input type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Dirección" full><input value={form.address} onChange={set('address')} /></Field>
        <Field label="¿Qué suministra?" full hint="Ej: lácteos, bebidas, repuestos para celular…"><input value={form.supplies} onChange={set('supplies')} /></Field>
        <Field label="Notas" full><textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Días de visita, condiciones de pago, pedido mínimo…" /></Field>
        <label className="check full"><input type="checkbox" checked={form.active} onChange={set('active')} /> Proveedor activo</label>
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}
