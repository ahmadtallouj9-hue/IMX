import { FormEvent, useState } from 'react';
import { DEFAULT_NATIVE_API, getApiUrl, setApiUrl } from '../lib/api';

export function ServerSetup({ onReady }: { onReady: () => void }) {
  const [url, setUrl] = useState(getApiUrl() || DEFAULT_NATIVE_API);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const next = url.trim().replace(/\/$/, '');
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${next}/health/live`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Server did not respond');
      setApiUrl(next);
      onReady();
    } catch {
      setError('Could not reach that server. Use https://imx-cbf0.onbelmo.uk');
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  }

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
            <p className="auth-kicker">Setup</p>
            <h1>IMX</h1>
            <p className="auth-tagline">Connect the app to IMX online.</p>
          </div>
        </aside>
        <form className="auth-card" onSubmit={(e) => void onSubmit(e)}>
          <div className="auth-card-head">
            <h2>Server</h2>
            <p>Most people should use the official IMX address.</p>
          </div>
          <label htmlFor="server-url">
            API URL
            <input
              id="server-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              required
            />
          </label>
          {error && <div className="banner error">{error}</div>}
          <button className="btn primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button
            className="btn tertiary"
            type="button"
            onClick={() => {
              setApiUrl(DEFAULT_NATIVE_API);
              onReady();
            }}
          >
            Use official IMX server
          </button>
        </form>
      </div>
    </div>
  );
}
