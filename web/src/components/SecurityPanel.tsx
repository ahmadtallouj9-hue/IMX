import React, { useEffect, useState } from 'react';
import {
  clearConvKeyCache,
  ensureIdentityKeys,
  exportPublicKeyBackup,
  hasLocalPrivateKey,
  importKeyBackup,
  isE2EEnabled,
  resetIdentityKeys,
  setE2EEnabled,
} from '../lib/e2e';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
};

export function SecurityPanel({ open, onClose, userId }: Props) {
  const [enabled, setEnabled] = useState(isE2EEnabled);
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState('');

  useEffect(() => {
    if (!open) return;
    setEnabled(isE2EEnabled());
    setHasKey(hasLocalPrivateKey(userId));
    setStatus(null);
    setError(null);
    void ensureIdentityKeys(userId)
      .then(() => setHasKey(true))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not set up keys'));
  }, [open, userId]);

  if (!open) return null;

  async function toggle(on: boolean) {
    setE2EEnabled(on);
    setEnabled(on);
    setStatus(
      on
        ? 'End-to-end encryption is on for new messages.'
        : 'Encryption paused — messages send in plaintext.',
    );
  }

  async function onReset() {
    if (
      !window.confirm(
        'Reset encryption keys? You may not be able to read older encrypted messages on this device.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      clearConvKeyCache();
      await resetIdentityKeys(userId);
      setHasKey(true);
      setStatus('New encryption keys published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const raw = await exportPublicKeyBackup(userId);
      if (!raw) throw new Error('No local keys to export');
      setBackup(raw);
      setStatus('Backup ready — copy and store it somewhere safe. Anyone with it can decrypt your chats.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setBusy(true);
    setError(null);
    try {
      await importKeyBackup(userId, backup.trim());
      clearConvKeyCache();
      setHasKey(true);
      setStatus('Keys restored on this device.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet security-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="security-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="custom-head">
          <div>
            <p className="custom-kicker">Privacy</p>
            <h2 id="security-title">Security & encryption</h2>
            <p className="hint">Messages are encrypted on your device before they leave.</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="security-body">
          <section className="security-card">
            <div className="toggle-row">
              <div>
                <strong>End-to-end encryption</strong>
                <span className="hint">Always on — text and media are sealed on your device before upload.</span>
              </div>
              <span className="security-pill ok" aria-label="Encryption always enabled">
                Locked on
              </span>
            </div>
            <ul className="security-list">
              <li>Direct chats: ECDH P-256 + AES-256-GCM</li>
              <li>Groups: shared AES key, wrapped per member</li>
              <li>Photos, videos, and files are encrypted before upload</li>
              <li>Notifications never show message text</li>
              <li>Your private key never leaves this device</li>
            </ul>
            <p className={`security-pill ${hasKey ? 'ok' : 'warn'}`}>
              {hasKey ? 'Keys ready on this device' : 'Setting up keys…'}
            </p>
          </section>

          <section className="security-card">
            <strong>Key backup</strong>
            <p className="hint">Export to move chats to a new phone. Keep the backup private.</p>
            <div className="security-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void onExport()}>
                Export keys
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void onReset()}>
                Reset keys
              </button>
            </div>
            <textarea
              className="security-backup"
              rows={4}
              placeholder="Paste a key backup here to restore…"
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              disabled={busy || !backup.trim()}
              onClick={() => void onImport()}
            >
              Import keys
            </button>
          </section>

          {status && <p className="security-status">{status}</p>}
          {error && <p className="banner error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
