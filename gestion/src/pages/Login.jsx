import { useState } from 'react';
import { BRAND } from '@shared/brand.js';
import { ThemeToggle } from '@shared/theme.jsx';
import DeveloperCredit from '@shared/DeveloperCredit.jsx';
import { useAuth } from '../auth.jsx';
import { ErrorMsg } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <ThemeToggle className="icon-btn theme-toggle login-theme" />
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src={BRAND.logo} alt={BRAND.name} />
        <h1>{BRAND.name}</h1>
        <p className="muted">{BRAND.tagline}</p>
        <ErrorMsg>{error}</ErrorMsg>
        <label className="field">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <button className="btn primary block" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      <footer className="login-footer">
        <DeveloperCredit showBrand={false} />
      </footer>
    </div>
  );
}
