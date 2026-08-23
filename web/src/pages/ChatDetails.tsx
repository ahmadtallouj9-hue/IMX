import { useEffect, useRef, useState } from 'react';
import { api, ApiError, toUploadPath } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import type { Conversation, PublicUser } from '../lib/types';
import { formatTime } from '../lib/messages';

const THEMES = [
  { id: 'chatter', label: 'IMX', color: '#e85d04' },
  { id: 'cove', label: 'Cove', color: '#c45c26' },
  { id: 'dusk', label: 'Dusk', color: '#7c3aed' },
  { id: 'ember', label: 'Ember', color: '#ea580c' },
  { id: 'moss', label: 'Moss', color: '#16a34a' },
  { id: 'midnight', label: 'Midnight', color: '#2563eb' },
] as const;

type Props = {
  conversation: Conversation;
  meId: string;
  people: PublicUser[];
  query: string;
  onQuery: (value: string) => void;
  onClose: () => void;
  onUpdated: (next: Conversation) => void;
  onLeft: () => void;
};

function Switch({
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className={`pref-row ${disabled ? 'is-busy' : ''}`}>
      <span className="pref-copy">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <button
        type="button"
        role="switch"
        className={`pref-switch ${checked ? 'on' : ''}`}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="pref-switch-knob" />
      </button>
    </label>
  );
}

export function ChatDetails({ conversation, meId, people, query, onQuery, onClose, onUpdated, onLeft }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const canAdd = conversation.type === 'GROUP';
  const backgroundPreview = useMediaSrc(conversation.backgroundUrl);
  const title = conversation.type === 'GROUP' ? 'Group settings' : 'Chat settings';
  const peer =
    conversation.type === 'DIRECT'
      ? conversation.members.find((m) => m.id !== meId) ?? conversation.members[0]
      : null;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  async function savePrefs(prefs: { muted?: boolean; pinned?: boolean; theme?: string; backgroundUrl?: string | null }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.updatePrefs(conversation.id, prefs);
      onUpdated({ ...conversation, ...res.prefs });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update chat');
    } finally {
      setBusy(false);
    }
  }

  async function addPerson(person: PublicUser) {
    setBusy(true);
    setError(null);
    try {
      await api.addMembers(conversation.id, [person.id]);
      onUpdated({
        ...conversation,
        members: conversation.members.some((m) => m.id === person.id)
          ? conversation.members
          : [...conversation.members, person],
      });
      onQuery('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  }

  async function onBackground(file: File) {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await api.upload(file);
      await savePrefs({ backgroundUrl: toUploadPath(uploaded.url) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set background');
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await api.leaveGroup(conversation.id);
      onLeft();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not leave');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet chat-details-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-details-title"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cd-head">
          <div className="cd-identity">
            <span className="cd-avatar" aria-hidden="true">
              {(peer?.displayName ?? conversation.title ?? 'G').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 id="chat-details-title">{title}</h2>
              <p className="cd-sub">
                {peer
                  ? `@${peer.username}`
                  : `${conversation.members.length} member${conversation.members.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <button className="icon-btn cd-close" type="button" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {error && <div className="banner error">{error}</div>}

        {conversation.type === 'GROUP' && (
          <section className="cd-section">
            <h3>Members</h3>
            <div className="cd-card member-list">
              {conversation.members.map((member) => (
                <div key={member.id} className="cd-member">
                  <span className="cd-member-av" aria-hidden="true">
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="pref-copy">
                    <strong>{member.displayName}</strong>
                    <small>@{member.username}{member.id === meId ? ' · you' : ''}</small>
                  </span>
                </div>
              ))}
            </div>
            {canAdd && (
              <label className="cd-field">
                Add people
                <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search usernames" />
              </label>
            )}
            {canAdd && people.map((person) => (
              <button key={person.id} className="cd-add-row" type="button" disabled={busy} onClick={() => void addPerson(person)}>
                <span className="pref-copy">
                  <strong>{person.displayName}</strong>
                  <small>@{person.username}</small>
                </span>
                <span className="cd-add-label">Add</span>
              </button>
            ))}
          </section>
        )}

        <section className="cd-section">
          <h3>Preferences</h3>
          <div className="cd-card">
            <Switch
              label="Mute notifications"
              hint="Silence alerts for this chat"
              checked={Boolean(conversation.muted)}
              disabled={busy}
              onChange={(muted) => void savePrefs({ muted })}
            />
            <Switch
              label="Pin to top"
              hint="Keep this chat at the top of your list"
              checked={Boolean(conversation.pinned)}
              disabled={busy}
              onChange={(pinned) => void savePrefs({ pinned })}
            />
          </div>
        </section>

        <section className="cd-section">
          <h3>Bubble theme</h3>
          <div className="cd-theme-grid" role="listbox" aria-label="Chat theme">
            {THEMES.map((theme) => {
              const active = conversation.theme === theme.id || (!conversation.theme && theme.id === 'chatter');
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`cd-theme ${active ? 'active' : ''}`}
                  disabled={busy}
                  onClick={() => void savePrefs({ theme: theme.id })}
                >
                  <span className="cd-theme-dot" style={{ background: theme.color }} />
                  <span>{theme.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="cd-section">
          <h3>Wallpaper</h3>
          <div className="cd-card cd-wallpaper">
            <div
              className={`cd-wall-preview ${backgroundPreview ? 'has-image' : ''}`}
              style={backgroundPreview ? { backgroundImage: `url(${backgroundPreview})` } : undefined}
            >
              {!backgroundPreview && <span>No wallpaper</span>}
              {conversation.backgroundUrl && (
                <button
                  className="btn cd-wall-remove"
                  type="button"
                  disabled={busy}
                  onClick={() => void savePrefs({ backgroundUrl: null })}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="cd-wall-actions">
              <label className="btn primary file-btn">
                {busy ? 'Uploading…' : 'Choose image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void onBackground(file);
                  }}
                />
              </label>
            </div>
          </div>
        </section>

        <footer className="cd-foot">
          {conversation.type === 'GROUP' && (
            <button className="btn danger" type="button" disabled={busy} onClick={() => void leave()}>
              Leave group
            </button>
          )}
          <p className="hint">Last activity {formatTime(conversation.lastMessageAt)}</p>
        </footer>
      </div>
    </div>
  );
}
