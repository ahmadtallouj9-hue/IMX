import { FormEvent, useState } from 'react';
import { getApiUrl, setApiUrl } from '../lib/api';

export function ServerSetup({ onReady }: { onReady: () => void }) {
  const [url, setUrl] = useState(getApiUrl() || 'http://192.168.1.214:8080');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const next = url.trim().replace(/\/$/, '');
    try {
      const res = await fetch(`${next}/health/live`);
      if (!res.ok) throw new Error('Server did not respond');
      setApiUrl(next);
      onReady();
    } catch {
      setError('Could not reach that server. Use your PC address, like http://192.168.1.214:8080');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="auth-hero-glow" aria-hidden="true" />
        <p className="brand auth-brand">
          <span className="logo-mark" />
          IMX
        </p>
        <h1 className="auth-wordmark" aria-hidden="true">IMX</h1>
        <p className="auth-tagline">Connect to your IMX server on the same Wi‑Fi.</p>
      </div>
      <form className="auth-card" onSubmit={(e) => void onSubmit(e)}>
        <h2>Server address</h2>
        <p className="auth-card-sub">Enter the API URL for your host machine.</p>
        <label>
          API URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" required />
        </label>
        {error && <div className="banner error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
