import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { canInstall, isStandalone, onInstallAvailable, promptInstall } from '../lib/install';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(canInstall());

  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password);
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim() || username.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brand">
          <span className="logo-mark" />
          Chatter
        </div>
        <h1>Welcome</h1>
        <p>Real-time messaging for everyone.</p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your space'}</h2>
        {mode === 'login' ? (
          <label>
            Username or email
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          </label>
        ) : (
          <>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </label>
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          </>
        )}
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} />
        </label>
        {error && <div className="banner error">{error}</div>}
        {installable && !isStandalone() && (
          <button className="btn" type="button" onClick={() => void promptInstall()}>
            Install Chatter app
          </button>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="switch">
          {mode === 'login' ? (
            <>New here? <Link to="/register">Create an account</Link></>
          ) : (
            <>Already have one? <Link to="/login">Sign in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
