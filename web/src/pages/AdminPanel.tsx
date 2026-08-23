import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import { formatTime, initials } from '../lib/messages';

export type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  activeSessions: number;
  lastSignInAt?: string | null;
  lastSignInIp?: string | null;
  lastUserAgent?: string | null;
};

type Props = {
  onClose: () => void;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString()} ${formatTime(iso)}`;
}

export function AdminPanel({ onClose }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'online'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminUsers();
      setUsers(res.users);
      setTotal(res.total);
      setOnline(res.online);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'online' && !u.isOnline) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, query, filter]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet friends-sheet admin-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="friends-head">
          <div>
            <p className="friends-kicker">Owner</p>
            <h2 id="admin-title">Signed-in users</h2>
          </div>
          <div className="admin-head-actions">
            <button className="btn tertiary friends-mini" type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="admin-stats">
          <div>
            <strong>{total}</strong>
            <span>accounts</span>
          </div>
          <div>
            <strong>{online}</strong>
            <span>online now</span>
          </div>
        </div>

        {error && <div className="banner error">{error}</div>}

        <section className="friends-section">
          <label className="friends-search">
            <span className="visually-hidden">Filter users</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, username, or email"
              aria-label="Filter users"
            />
          </label>
          <div className="admin-filters">
            <button
              type="button"
              className={`btn friends-mini ${filter === 'all' ? 'primary' : 'tertiary'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`btn friends-mini ${filter === 'online' ? 'primary' : 'tertiary'}`}
              onClick={() => setFilter('online')}
            >
              Online
            </button>
          </div>
        </section>

        <section className="friends-section friends-list-section">
          <div className="friends-section-head">
            <h3>People</h3>
            <span>{filtered.length}</span>
          </div>
          <div className="friends-card admin-card">
            {loading && <p className="friends-empty">Loading…</p>}
            {!loading && filtered.length === 0 && <p className="friends-empty">No users match</p>}
            {!loading &&
              filtered.map((u) => (
                <AdminRow key={u.id} user={u} />
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminRow({ user }: { user: AdminUserRow }) {
  const avatarSrc = useMediaSrc(user.avatarUrl);
  return (
    <div className={`friends-row admin-row ${user.isOnline ? 'is-online' : ''}`}>
      <span className={`avatar sm ${user.isOnline ? 'online' : ''}`}>
        {avatarSrc ? <img src={avatarSrc} alt="" /> : initials(user.displayName || user.username)}
      </span>
      <div className="admin-row-meta">
        <strong>{user.displayName || user.username}</strong>
        <span>@{user.username} · {user.email}</span>
        <span className="admin-row-detail">
          {user.isOnline ? 'Online now' : `Last seen ${formatWhen(user.lastSeenAt)}`}
          {' · '}
          Signed up {formatWhen(user.createdAt)}
        </span>
        <span className="admin-row-detail">
          {user.activeSessions > 0
            ? `${user.activeSessions} active session${user.activeSessions === 1 ? '' : 's'}`
            : 'No active sessions'}
          {user.lastSignInAt ? ` · Last sign-in ${formatWhen(user.lastSignInAt)}` : ''}
          {user.lastSignInIp ? ` · ${user.lastSignInIp}` : ''}
        </span>
      </div>
      <em className={`friends-status ${user.isOnline ? 'on' : ''}`}>
        {user.isOnline ? 'Online' : 'Away'}
      </em>
    </div>
  );
}
