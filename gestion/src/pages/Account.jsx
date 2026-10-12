import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorMsg, Field, PageHeader } from '../components/ui.jsx';

export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setOk(false);
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    try {
      await api('/auth/me/password', { method: 'PUT', body: { current: form.current, password: form.password } });
      setOk(true);
      setForm({ current: '', password: '', confirm: '' });
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.name} · ${user.email}`} />
      <section className="card narrow">
        <h3>Cambiar contraseña</h3>
        <form className="form-grid one" onSubmit={submit}>
          <ErrorMsg>{error}</ErrorMsg>
          {ok && <div className="alert success">Contraseña actualizada.</div>}
          <Field label="Contraseña actual"><input type="password" value={form.current} onChange={set('current')} required /></Field>
          <Field label="Nueva contraseña"><input type="password" minLength={6} value={form.password} onChange={set('password')} required /></Field>
          <Field label="Confirmar nueva contraseña"><input type="password" minLength={6} value={form.confirm} onChange={set('confirm')} required /></Field>
          <div className="form-actions"><button className="btn primary">Actualizar</button></div>
        </form>
      </section>
    </>
  );
}
