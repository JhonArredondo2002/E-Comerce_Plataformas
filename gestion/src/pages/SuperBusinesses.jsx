import { useState } from 'react';
import { api, img, TIENDA_URL } from '../api.js';
import BusinessForm, { businessFormData } from '../components/BusinessForm.jsx';
import { Badge, Empty, ErrorMsg, Field, Modal, PageHeader, useLoad } from '../components/ui.jsx';

/** Panel del superadmin: alta y administración de negocios. */
export default function SuperBusinesses() {
  const { data, error, reload } = useLoad('/admin/businesses');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const toggle = async (b) => {
    const fd = new FormData();
    fd.append('active', b.active ? '0' : '1');
    await api(`/admin/businesses/${b.id}`, { method: 'PUT', body: fd });
    reload();
  };

  const remove = async (b) => {
    if (!confirm(`¿Eliminar "${b.name}" y TODA su información (usuarios, ventas, productos…)? Esta acción no se puede deshacer.`)) return;
    await api(`/admin/businesses/${b.id}`, { method: 'DELETE' });
    reload();
  };

  return (
    <>
      <PageHeader title="Negocios" subtitle="Crea negocios y asígnales su usuario administrador">
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nuevo negocio</button>
      </PageHeader>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>No hay negocios registrados.</Empty>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th /><th>Negocio</th><th>Categoría</th><th>Ciudad</th><th className="num">Usuarios</th><th className="num">Productos</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id}>
                  <td className="thumb-cell">{b.logo ? <img className="thumb" src={img(b.logo)} alt="" /> : <div className="thumb empty-thumb" />}</td>
                  <td>
                    <strong>{b.name}</strong>
                    <div className="small"><a className="link" href={`${TIENDA_URL}/${b.slug}`} target="_blank" rel="noreferrer">/{b.slug} ↗</a></div>
                  </td>
                  <td>{b.category}</td>
                  <td>{b.city}{b.neighborhood ? <div className="muted small">{b.neighborhood}</div> : null}</td>
                  <td className="num">{b.users_count}</td>
                  <td className="num">{b.products_count}</td>
                  <td>{b.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
                  <td className="actions-cell">
                    <button className="btn ghost small" onClick={async () => setEditing(await api(`/admin/businesses/${b.id}`))}>Editar</button>
                    <button className="btn ghost small" onClick={() => toggle(b)}>{b.active ? 'Desactivar' : 'Activar'}</button>
                    <button className="btn ghost small danger" onClick={() => remove(b)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateBusiness onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {editing && <EditBusiness business={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function CreateBusiness({ onClose, onSaved }) {
  const [admin, setAdmin] = useState({ admin_name: '', admin_email: '', admin_password: '' });
  const set = (k) => (e) => setAdmin({ ...admin, [k]: e.target.value });

  const submit = async (values, files) => {
    await api('/admin/businesses', { method: 'POST', body: businessFormData(values, files, admin) });
    onSaved();
  };

  const extra = (
    <>
      <h4 className="full section-title">Usuario administrador del negocio</h4>
      <Field label="Nombre *"><input value={admin.admin_name} onChange={set('admin_name')} required /></Field>
      <Field label="Correo (usuario) *"><input type="email" value={admin.admin_email} onChange={set('admin_email')} required /></Field>
      <Field label="Contraseña *" hint="Mínimo 6 caracteres"><input type="password" minLength={6} value={admin.admin_password} onChange={set('admin_password')} required /></Field>
    </>
  );

  return (
    <Modal title="Nuevo negocio" onClose={onClose} wide>
      <BusinessForm initial={{}} showSlug onSubmit={submit} submitLabel="Crear negocio" extra={extra} onCancel={onClose} />
    </Modal>
  );
}

function EditBusiness({ business, onClose, onSaved }) {
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [users, setUsers] = useState(business.users);

  const submit = async (values, files) => {
    await api(`/admin/businesses/${business.id}`, { method: 'PUT', body: businessFormData(values, files) });
    onSaved();
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api(`/admin/businesses/${business.id}/admins`, { method: 'POST', body: newAdmin });
      const b = await api(`/admin/businesses/${business.id}`);
      setUsers(b.users);
      setNewAdmin({ name: '', email: '', password: '' });
    } catch (err) { setMsg(err.message); }
  };

  return (
    <Modal title={`Editar: ${business.name}`} onClose={onClose} wide>
      <BusinessForm initial={business} showSlug onSubmit={submit} onCancel={onClose} />
      <hr />
      <h4>Usuarios del negocio</h4>
      <table className="table compact">
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? 'Activo' : 'Inactivo'}</td></tr>
          ))}
        </tbody>
      </table>
      <form className="form-grid" onSubmit={addAdmin}>
        <ErrorMsg>{msg}</ErrorMsg>
        <h4 className="full section-title">Agregar otro administrador</h4>
        <Field label="Nombre"><input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} required /></Field>
        <Field label="Correo"><input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required /></Field>
        <Field label="Contraseña"><input type="password" minLength={6} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} required /></Field>
        <div className="form-actions"><button className="btn secondary">Agregar administrador</button></div>
      </form>
    </Modal>
  );
}
