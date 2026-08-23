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

  useEffect(() => {
    document.documentElement.classList.add('light');
  }, []);

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
      <div className="auth-atmosphere" aria-hidden="true">
        <div className="auth-wash" />
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />
        <div className="auth-grid" />
      </div>

      <div className="auth-shell">
        <aside className="auth-brand">
          <header className="auth-top">
            <span className="logo-mark" />
            <strong className="auth-name">IMX</strong>
          </header>

          <div className="auth-copy">
            <p className="auth-kicker">Real-time messaging</p>
            <h1>IMX</h1>
            <p className="auth-tagline">Quiet chats. Fast replies. Yours across phone and PC.</p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-bubble theirs">
              <span className="auth-bubble-name">Maya</span>
              You free in a bit?
            </div>
            <div className="auth-bubble mine">Yeah — give me five.</div>
            <div className="auth-bubble theirs typing">
              <i /><i /><i />
            </div>
          </div>

          <div className="auth-installs">
            <p className="auth-installs-label">Install IMX</p>
            <div className="auth-install-row">
              <a
                className="auth-install android"
                href="https://imx-cbf0.onbelmo.uk/download/android"
                download="imx.apk"
              >
                <span className="auth-install-icon" aria-hidden="true">
                  <AndroidIcon />
                </span>
                <span className="auth-install-copy">
                  <strong>Android</strong>
                  <small>Install APK</small>
                </span>
              </a>
              <a
                className="auth-install windows"
                href="https://imx-cbf0.onbelmo.uk/download/windows"
                download="imx-windows.exe"
              >
                <span className="auth-install-icon" aria-hidden="true">
                  <WindowsIcon />
                </span>
                <span className="auth-install-copy">
                  <strong>Windows</strong>
                  <small>Install app</small>
                </span>
              </a>
            </div>
            <a className="auth-get-app" href="https://imx-cbf0.onbelmo.uk/download.html">
              More info
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </aside>

        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <h2>{mode === 'login' ? 'Welcome back' : 'Join IMX'}</h2>
            <p>
              {mode === 'login'
                ? 'Sign in to pick up where you left off.'
                : 'Create an account to start chatting.'}
            </p>
          </div>

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

          {error && (
            <div className="banner error" role="alert" id={errorId}>
              {error}
            </div>
          )}

          <button className="btn primary auth-submit" type="submit" disabled={busy}>
            {busy && <span className="btn-spinner" aria-hidden="true" />}
            {busy ? 'Please wait…' : mode === 'login' ? 'Continue' : 'Create account'}
          </button>

          <p className="auth-switch">
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

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.5.5 0 10-.87-.5l-1.86 3.22A7.93 7.93 0 0012 8c-1.64 0-3.15.5-4.41 1.34L5.73 5.8a.5.5 0 10-.87.5l1.84 3.18A8 8 0 004 16v1.5A1.5 1.5 0 005.5 19h13a1.5 1.5 0 001.5-1.5V16a8 8 0 00-2.4-6.52zM9 15.25a.75.75 0 110-1.5.75.75 0 010 1.5zm6 0a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5l7.5-1.05V11H3V5.5zm8.5-1.2L21 3v8h-9.5V4.3zM3 13h7.5v6.55L3 18.5V13zm8.5 0H21v8l-9.5-1.35V13z" />
    </svg>
  );
}
