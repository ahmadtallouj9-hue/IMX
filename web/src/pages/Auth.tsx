import { FormEvent, useEffect, useId, useState } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(canInstall());
  const errorId = useId();
  const idPrefix = useId();

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

  const describedBy = error ? errorId : undefined;

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="brand">
          <span className="logo-mark" />
          IMX
        </div>
        <h1>Messages that feel instant</h1>
        <p>Real-time chat, friends, and private conversations — clean, fast, and ready wherever you are.</p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your space'}</h2>
        {mode === 'login' ? (
          <label htmlFor={`${idPrefix}-identifier`}>
            Username or email
            <input
              id={`${idPrefix}-identifier`}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              aria-describedby={describedBy}
            />
          </label>
        ) : (
          <>
            <label htmlFor={`${idPrefix}-username`}>
              Username
              <input
                id={`${idPrefix}-username`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                aria-describedby={describedBy}
              />
            </label>
            <label htmlFor={`${idPrefix}-display`}>
              Display name
              <input
                id={`${idPrefix}-display`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <label htmlFor={`${idPrefix}-email`}>
              Email
              <input
                id={`${idPrefix}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                aria-describedby={describedBy}
              />
            </label>
          </>
        )}
        <label htmlFor={`${idPrefix}-password`}>
          Password
          <span className="password-field">
            <input
              id={`${idPrefix}-password`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              aria-describedby={describedBy}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>
        {error && <div className="banner error" role="alert" id={errorId}>{error}</div>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy && <span className="btn-spinner" aria-hidden="true" />}
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="switch">
          {mode === 'login' ? (
            <>New here? <Link to="/register">Create an account</Link></>
          ) : (
            <>Already have one? <Link to="/login">Sign in</Link></>
          )}
        </p>
        {installable && !isStandalone() && (
          <button className="btn tertiary" type="button" onClick={() => void promptInstall()}>
            Install IMX app
          </button>
        )}
      </form>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.8 21.8 0 01-2.16 3.19" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
