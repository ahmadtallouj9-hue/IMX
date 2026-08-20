import { useState } from 'react';
import { api, ApiError, toUploadPath } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import type { Conversation, PublicUser } from '../lib/types';
import { formatTime } from '../lib/messages';

const THEMES = [
  { id: 'chatter', label: 'IMX' },
  { id: 'cove', label: 'Cove' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'ember', label: 'Ember' },
  { id: 'moss', label: 'Moss' },
  { id: 'midnight', label: 'Midnight' },
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

export function ChatDetails({ conversation, meId, people, query, onQuery, onClose, onUpdated, onLeft }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canAdd = conversation.type === 'GROUP';
  const backgroundPreview = useMediaSrc(conversation.backgroundUrl);

  async function savePrefs(prefs: { muted?: boolean; theme?: string; backgroundUrl?: string | null }) {
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
      <div className="sheet wide" onClick={(e) => e.stopPropagation()}>
        <h2>{conversation.type === 'GROUP' ? 'Group settings' : 'Chat settings'}</h2>
        {error && <div className="banner error">{error}</div>}

        {conversation.type === 'GROUP' && (
          <>
            <h3>Members</h3>
            <div className="member-list">
              {conversation.members.map((member) => (
                <div key={member.id} className="row static">
                  <span>
                    <strong>{member.displayName}</strong>
                    <small>@{member.username}{member.id === meId ? ' · you' : ''}</small>
                  </span>
                </div>
              ))}
            </div>
            {canAdd && (
              <label>
                Add people
                <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search usernames" />
              </label>
            )}
            {canAdd && people.map((person) => (
              <button key={person.id} className="row" type="button" disabled={busy} onClick={() => void addPerson(person)}>
                <span>
                  <strong>{person.displayName}</strong>
                  <small>@{person.username}</small>
                </span>
              </button>
            ))}
          </>
        )}

        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(conversation.muted)}
            disabled={busy}
            onChange={(e) => void savePrefs({ muted: e.target.checked })}
          />
          Mute this chat
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(conversation.pinned)}
            disabled={busy}
            onChange={(e) => void savePrefs({ pinned: e.target.checked })}
          />
          Pin to top
        </label>

        <h3>Theme</h3>
        <div className="theme-row">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-swatch ${theme.id} ${conversation.theme === theme.id ? 'active' : ''}`}
              disabled={busy}
              onClick={() => void savePrefs({ theme: theme.id })}
            >
              {theme.label}
            </button>
          ))}
        </div>

        <h3>Background</h3>
        {backgroundPreview && <img className="bg-preview" src={backgroundPreview} alt="" />}
        <div className="actions">
          <label className="file">
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
          {conversation.backgroundUrl && (
            <button className="btn" type="button" disabled={busy} onClick={() => void savePrefs({ backgroundUrl: null })}>
              Remove image
            </button>
          )}
        </div>

        <div className="actions">
          {conversation.type === 'GROUP' && (
            <button className="btn danger" type="button" disabled={busy} onClick={() => void leave()}>
              Leave group
            </button>
          )}
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
        <p className="hint">Last activity {formatTime(conversation.lastMessageAt)}</p>
      </div>
    </div>
  );
}
