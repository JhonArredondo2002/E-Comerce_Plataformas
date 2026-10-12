import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Badge, ErrorMsg, Field, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'colaborador', position: '', phone: '', active: true };

export default function Collaborators() {
  const { user, isAdmin } = useAuth();
  const { data, error, reload } = useLoad('/users');
  const [editing, setEditing] = useState(null);

  const remove = async (u) => {
    if (!confirm(`¿Eliminar a "${u.name}"? Ya no podrá ingresar al sistema.`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Colaboradores"
        subtitle={isAdmin ? 'Personas con acceso a la información de tu negocio' : 'Equipo de tu negocio (solo un administrador puede modificarlo)'}
      >
        {isAdmin && <button className="btn primary" onClick={() => setEditing(EMPTY)}>+ Nuevo colaborador</button>}
      </PageHeader>
      <ErrorMsg>{error}</ErrorMsg>
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Cargo</th><th>Teléfono</th><th>Rol</th><th>Estado</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>{u.name} {u.id === user.id && <span className="muted">(tú)</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.position}</td>
                  <td>{u.phone}</td>
                  <td>{u.role === 'admin' ? <Badge tone="blue">Administrador</Badge> : <Badge>Colaborador</Badge>}</td>
                  <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
                  {isAdmin && (
                    <td className="actions-cell">
                      <button className="btn ghost small" onClick={() => setEditing(u)}>Editar</button>
                      {u.id !== user.id && <button className="btn ghost small danger" onClick={() => remove(u)}>Eliminar</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserForm u={editing} self={editing.id === user.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function UserForm({ u, self, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...u, password: '', active: !!u.active });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form };
      if (u.id && !body.password) delete body.password;
      await api(u.id ? `/users/${u.id}` : '/users', { method: u.id ? 'PUT' : 'POST', body });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <Modal title={u.id ? 'Editar colaborador' : 'Nuevo colaborador'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Nombre *" full><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Correo (usuario) *"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label={u.id ? 'Nueva contraseña' : 'Contraseña *'} hint={u.id ? 'Déjala vacía para no cambiarla' : 'Mínimo 6 caracteres'}>
          <input type="password" value={form.password} onChange={set('password')} required={!u.id} minLength={6} />
        </Field>
        <Field label="Cargo"><input value={form.position} onChange={set('position')} placeholder="Vendedor, cajero…" /></Field>
        <Field label="Teléfono"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Rol" hint="El administrador además puede gestionar colaboradores y el perfil del negocio">
          <select value={form.role} onChange={set('role')} disabled={self}>
            <option value="colaborador">Colaborador</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>
        {!self && <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Usuario activo</label>}
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
