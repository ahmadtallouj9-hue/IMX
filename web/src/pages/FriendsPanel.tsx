import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import { initials } from '../lib/messages';
import type { PublicUser } from '../lib/types';

type FriendRequest = {
  id: string;
  user: PublicUser;
  createdAt: string;
};

type Props = {
  meId: string;
  onClose: () => void;
  onMessage: (user: PublicUser) => void;
};

export function FriendsPanel({ meId, onClose, onMessage }: Props) {
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([api.friends(), api.friendRequests()]);
      setFriends(friendsRes.friends);
      setReceived(requestsRes.received);
      setSent(requestsRes.sent);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPeople([]);
      return;
    }
    const handle = window.setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then((res) => setPeople(res.users.filter((u) => u.id !== meId)))
        .catch(() => setPeople([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, meId]);

  const friendIds = new Set(friends.map((f) => f.id));
  const sentIds = new Set(sent.map((s) => s.user.id));
  const receivedIds = new Set(received.map((r) => r.user.id));

  async function sendRequest(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.sendFriendRequest(userId);
      await load();
      setQuery('');
      setPeople([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send request');
    } finally {
      setBusy(false);
    }
  }

  async function accept(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.acceptFriendRequest(requestId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept request');
    } finally {
      setBusy(false);
    }
  }

  async function reject(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.rejectFriendRequest(requestId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject request');
    } finally {
      setBusy(false);
    }
  }

  async function remove(friendId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.removeFriend(friendId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove friend');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet friends-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="friends-head">
          <div>
            <p className="friends-kicker">People</p>
            <h2 id="friends-title">Friends</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {error && <div className="banner error">{error}</div>}

        <section className="friends-section">
          <h3>Find people</h3>
          <label className="friends-search">
            <span className="visually-hidden">Search usernames</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search usernames"
              autoFocus
            />
          </label>
          {people.length > 0 && (
            <div className="friends-card">
              {people.map((person) => {
                const isFriend = friendIds.has(person.id);
                const pending = sentIds.has(person.id) || receivedIds.has(person.id);
                return (
                  <div key={person.id} className="friends-row">
                    <Avatar user={person} />
                    <span className="pref-copy">
                      <strong>{person.displayName}</strong>
                      <small>@{person.username}</small>
                    </span>
                    {isFriend ? (
                      <span className="friends-status">Friends</span>
                    ) : pending ? (
                      <span className="friends-status">Pending</span>
                    ) : (
                      <button className="btn primary friends-mini" type="button" disabled={busy} onClick={() => void sendRequest(person.id)}>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {query.trim().length >= 2 && people.length === 0 && (
            <p className="friends-empty">No users match “{query.trim()}”</p>
          )}
        </section>

        {received.length > 0 && (
          <section className="friends-section">
            <div className="friends-section-head">
              <h3>Requests</h3>
              <span>{received.length}</span>
            </div>
            <div className="friends-card">
              {received.map((req) => (
                <div key={req.id} className="friends-row">
                  <Avatar user={req.user} />
                  <span className="pref-copy">
                    <strong>{req.user.displayName}</strong>
                    <small>@{req.user.username}</small>
                  </span>
                  <div className="friends-row-actions">
                    <button className="btn primary friends-mini" type="button" disabled={busy} onClick={() => void accept(req.id)}>
                      Accept
                    </button>
                    <button className="btn friends-mini" type="button" disabled={busy} onClick={() => void reject(req.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="friends-section friends-list-section">
          <div className="friends-section-head">
            <h3>Your friends</h3>
            {!loading && <span>{friends.length}</span>}
          </div>
          <div className="friends-card">
            {loading && <p className="friends-empty">Loading…</p>}
            {!loading && friends.length === 0 && (
              <p className="friends-empty">No friends yet. Search for someone above.</p>
            )}
            {friends.map((friend) => (
              <div key={friend.id} className="friends-row">
                <Avatar user={friend} />
                <span className="pref-copy">
                  <strong>{friend.displayName}</strong>
                  <small>@{friend.username}</small>
                </span>
                <div className="friends-row-actions">
                  <button
                    className="btn primary friends-mini"
                    type="button"
                    onClick={() => {
                      onClose();
                      onMessage(friend);
                    }}
                  >
                    Message
                  </button>
                  <button className="btn friends-mini" type="button" disabled={busy} onClick={() => void remove(friend.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: PublicUser }) {
  const src = useMediaSrc(user.avatarUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  return (
    <span className="avatar">
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : (
        initials(user.displayName || user.username)
      )}
    </span>
  );
}
