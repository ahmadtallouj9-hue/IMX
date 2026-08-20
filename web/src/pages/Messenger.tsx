import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getApiUrl, setApiUrl, toUploadPath } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import { canInstall, isStandalone, promptInstall } from '../lib/install';
import { useAuth } from '../lib/auth';
import { formatTime, groupMessages, initials, newClientId, receiptLabel } from '../lib/messages';
import { connectSocket, joinConversation } from '../lib/socket';
import type { ChatMessage, Conversation, PublicUser } from '../lib/types';
import { ChatDetails } from './ChatDetails';
import { FriendsPanel } from './FriendsPanel';

type PresenceMap = Record<string, { isOnline: boolean; lastSeenAt?: string | null }>;

export function Messenger() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const me = user!;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [presence, setPresence] = useState<PresenceMap>({});
  const [connected, setConnected] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewedUser, setViewedUser] = useState<PublicUser | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupPicks, setGroupPicks] = useState<PublicUser[]>([]);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef<number>();

  const active = conversations.find((c) => c.id === conversationId) ?? null;

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.conversations();
      setConversations(res.conversations);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Could not load conversations');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const socket = connectSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessage = (payload: ChatMessage) => {
      setMessages((curr) => {
        if (!conversationId || payload.conversationId !== conversationId) return curr;
        if (curr.some((m) => m.id === payload.id || (payload.clientMessageId && m.clientMessageId === payload.clientMessageId))) {
          return curr.map((m) => (m.clientMessageId && m.clientMessageId === payload.clientMessageId ? payload : m));
        }
        return [...curr, payload];
      });
      setConversations((curr) => {
        const preview = {
          body: payload.body,
          senderName: payload.sender.displayName,
          createdAt: payload.createdAt,
        };
        const existing = curr.find((c) => c.id === payload.conversationId);
        if (!existing) {
          void loadConversations();
          return curr;
        }
        const unread =
          payload.conversationId === conversationId || payload.sender.id === me.id || existing.muted
            ? existing.unreadCount
            : existing.unreadCount + 1;
        return [
          { ...existing, lastMessage: preview, lastMessageAt: payload.createdAt, unreadCount: unread },
          ...curr.filter((c) => c.id !== payload.conversationId),
        ];
      });
      if (payload.conversationId === conversationId && payload.sender.id !== me.id) {
        socket.emit('message:read', { conversationId, messageId: payload.id });
      }
    };
    const onTypingStart = (p: { userId: string; displayName?: string; conversationId: string }) => {
      if (p.conversationId !== conversationId || p.userId === me.id) return;
      setTyping((curr) => ({ ...curr, [p.userId]: p.displayName ?? 'Someone' }));
    };
    const onTypingStop = (p: { userId: string; conversationId: string }) => {
      if (p.conversationId !== conversationId) return;
      setTyping((curr) => {
        const next = { ...curr };
        delete next[p.userId];
        return next;
      });
    };
    const onRead = (p: { userId: string; messageId: string; conversationId: string; readAt: string }) => {
      if (p.conversationId !== conversationId) return;
      setMessages((curr) =>
        curr.map((m) =>
          m.id === p.messageId && !m.readBy.some((r) => r.userId === p.userId)
            ? { ...m, status: 'READ', readBy: [...m.readBy, { userId: p.userId, readAt: p.readAt }] }
            : m,
        ),
      );
    };
    const onPresence = (p: { userId: string; isOnline: boolean; lastSeenAt?: string | null }) => {
      setPresence((curr) => ({ ...curr, [p.userId]: { isOnline: p.isOnline, lastSeenAt: p.lastSeenAt } }));
    };
    const onSnapshot = (p: { userIds: string[] }) => {
      setPresence((curr) => {
        const next = { ...curr };
        for (const id of p.userIds) next[id] = { isOnline: true };
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:read', onRead);
    socket.on('presence:update', onPresence);
    socket.on('presence:snapshot', onSnapshot);
    if (socket.connected) setConnected(true);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('message:read', onRead);
      socket.off('presence:update', onPresence);
      socket.off('presence:snapshot', onSnapshot);
    };
  }, [conversationId, loadConversations, me.id]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    joinConversation(conversationId);
    setChatLoading(true);
    setChatError(null);
    stickToBottom.current = true;
    api
      .messages(conversationId)
      .then((res) => {
        setMessages(res.messages.slice().reverse());
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        return api.markRead(conversationId);
      })
      .then(() => {
        setConversations((curr) => curr.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
      })
      .catch((err) => setChatError(err instanceof ApiError ? err.message : 'Could not load messages'))
      .finally(() => setChatLoading(false));
  }, [conversationId]);

  useEffect(() => {
    if (!stickToBottom.current || !scroller.current) return;
    scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, typing, conversationId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPeople([]);
      return;
    }
    const handle = window.setTimeout(() => {
      api.searchUsers(query.trim()).then((res) => setPeople(res.users)).catch(() => setPeople([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, query]);

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const typingNames = Object.values(typing);

  async function openDirect(person: PublicUser) {
    const res = await api.createConversation([person.id]);
    setQuery('');
    setPeople([]);
    await loadConversations();
    joinConversation(res.conversationId);
    navigate(`/c/${res.conversationId}`);
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (groupPicks.length === 0 || !groupTitle.trim()) return;
    const res = await api.createConversation(groupPicks.map((p) => p.id), groupTitle.trim());
    setGroupOpen(false);
    setGroupTitle('');
    setGroupPicks([]);
    await loadConversations();
    joinConversation(res.conversationId);
    navigate(`/c/${res.conversationId}`);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!conversationId || !body || sending) return;
    setSending(true);
    setChatError(null);
    const clientMessageId = newClientId();
    const optimistic: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      body,
      type: 'TEXT',
      status: 'SENT',
      sender: me,
      conversationId,
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    setMessages((curr) => [...curr, optimistic]);
    setDraft('');
    stickToBottom.current = true;
    connectSocket().emit('typing:stop', { conversationId });
    joinConversation(conversationId);
    try {
      const res = await api.sendMessage(conversationId, body, clientMessageId);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      void loadConversations();
    } catch (err) {
      setMessages((curr) => curr.filter((m) => m.clientMessageId !== clientMessageId));
      setDraft(body);
      setChatError(err instanceof ApiError ? err.message : 'Message failed');
    } finally {
      setSending(false);
    }
  }

  function onDraft(value: string) {
    setDraft(value);
    if (!conversationId) return;
    const socket = connectSocket();
    socket.emit('typing:start', { conversationId });
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => socket.emit('typing:stop', { conversationId }), 1200);
  }

  async function loadOlder() {
    if (!conversationId || !nextCursor || loadingOlder) return;
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const res = await api.messages(conversationId, nextCursor);
      setMessages((curr) => [...res.messages.slice().reverse(), ...curr]);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 48 && hasMore) void loadOlder();
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const res = await api.updateMe({ displayName: displayName.trim() });
    setUser(res.user);
    setProfileOpen(false);
  }

  async function onAvatar(file: File) {
    setProfileError(null);
    setAvatarBusy(true);
    try {
      const uploaded = await api.upload(file);
      const res = await api.updateMe({ avatarUrl: toUploadPath(uploaded.url) });
      setUser(res.user);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Could not update photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  const title = active
    ? active.type === 'GROUP'
      ? active.title ?? 'Group'
      : active.members.find((m) => m.id !== me.id)?.displayName ?? active.title ?? 'Chat'
    : 'Conversation';
  const peer = active?.type === 'DIRECT' ? active.members.find((m) => m.id !== me.id) : undefined;
  const peerPresence = peer ? presence[peer.id] : undefined;
  const peerOnline = peerPresence?.isOnline ?? peer?.isOnline ?? false;
  const backgroundSrc = useMediaSrc(active?.backgroundUrl);
  const backgroundStyle = backgroundSrc
    ? {
        backgroundImage: `linear-gradient(rgba(14,20,24,0.62), rgba(14,20,24,0.72)), url("${backgroundSrc}")`,
      }
    : undefined;

  return (
    <div className={`shell ${conversationId ? 'chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-head">
          <div className="brand compact">
            <span className="logo-mark" />
            IMX
          </div>
          <button className="icon-btn" type="button" onClick={() => setFriendsOpen(true)} aria-label="Friends">
            ☺
          </button>
          <button className="icon-btn" type="button" onClick={() => setGroupOpen(true)} aria-label="New group">
            +
          </button>
        </header>
        <div className="search-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or chats"
            aria-label="Search"
          />
        </div>
        {!connected && <div className="banner warn">Reconnecting…</div>}
        {listError && <div className="banner error">{listError}</div>}
        {people.length > 0 && (
          <div className="people">
            {people.map((person) => (
              <button key={person.id} className="row" type="button" onClick={() => void openDirect(person)}>
                <Avatar user={person} />
                <span>
                  <strong>{person.displayName}</strong>
                  <small>@{person.username}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="conv-list">
          {listLoading && <div className="empty">Loading conversations…</div>}
          {!listLoading && filtered.length === 0 && people.length === 0 && (
            <div className="empty">No conversations yet. Search for someone to start one.</div>
          )}
          {filtered.map((conv) => {
            const name =
              conv.type === 'GROUP'
                ? conv.title ?? 'Group'
                : conv.members.find((m) => m.id !== me.id)?.displayName ?? conv.title ?? 'Chat';
            const other = conv.members.find((m) => m.id !== me.id);
            const online = other ? presence[other.id]?.isOnline ?? other.isOnline : false;
            return (
              <button
                key={conv.id}
                className={`row conv ${conv.id === conversationId ? 'active' : ''}`}
                type="button"
                onClick={() => navigate(`/c/${conv.id}`)}
              >
                <Avatar user={other ?? { id: conv.id, username: name, displayName: name, avatarUrl: conv.imageUrl }} online={!!online && conv.type === 'DIRECT'} />
                <span className="grow">
                  <strong>{name}</strong>
                  <small>{conv.lastMessage?.body ?? 'No messages yet'}</small>
                </span>
                <span className="meta">
                  <time>{formatTime(conv.lastMessageAt)}</time>
                  {conv.muted ? <small>Muted</small> : conv.unreadCount > 0 && <em>{conv.unreadCount}</em>}
                </span>
              </button>
            );
          })}
        </div>
        <button className="me" type="button" onClick={() => setProfileOpen(true)}>
          <Avatar user={me} />
          <span>
            <strong>{me.displayName}</strong>
            <small>@{me.username}</small>
          </span>
        </button>
      </aside>

      <main className="main" data-theme={active?.theme ?? 'chatter'}>
        {!conversationId && (
          <div className="empty center">
            <h2>Pick a conversation</h2>
            <p>Search for a person or open a thread from the left.</p>
          </div>
        )}
        {conversationId && (
          <>
            <header className="chat-head">
              <button className="icon-btn back" type="button" onClick={() => navigate('/')} aria-label="Back">
                ←
              </button>
              <button className="row plain" type="button" onClick={() => (peer ? setViewedUser(peer) : setDetailsOpen(true))}>
                <Avatar user={peer ?? { id: conversationId, username: title, displayName: title, avatarUrl: active?.imageUrl }} online={peerOnline} />
                <span>
                  <strong>{title}</strong>
                  <small>
                    {peer
                      ? peerOnline
                        ? 'Online'
                        : peerPresence?.lastSeenAt
                          ? `Last seen ${formatTime(peerPresence.lastSeenAt)}`
                          : 'Offline'
                      : `${active?.members.length ?? 0} members`}
                  </small>
                </span>
              </button>
              <button className="icon-btn" type="button" onClick={() => setDetailsOpen(true)} aria-label="Chat settings">
                ⋯
              </button>
            </header>
            <div
              className={`messages ${active?.backgroundUrl ? 'has-bg' : ''}`}
              ref={scroller}
              onScroll={onScroll}
              style={backgroundStyle}
            >
              {chatLoading && <div className="empty">Loading messages…</div>}
              {chatError && <div className="banner error">{chatError}</div>}
              {hasMore && (
                <button className="link" type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>
                  {loadingOlder ? 'Loading…' : 'Load older messages'}
                </button>
              )}
              {!chatLoading && messages.length === 0 && <div className="empty">Say hello — this thread is empty.</div>}
              {groups.map((group) => {
                const mine = group.senderId === me.id;
                return (
                  <div key={group.messages[0].id} className={`bundle ${mine ? 'mine' : ''}`}>
                    {!mine && <Avatar user={group.sender} />}
                    <div className="stack">
                      {!mine && <span className="who">{group.sender.displayName}</span>}
                      {group.messages.map((message, index) => (
                        <div key={message.id} className="bubble">
                          <p>{message.body}</p>
                          {index === group.messages.length - 1 && (
                            <span className="stamp">
                              {formatTime(message.createdAt)}
                              {mine && ` · ${receiptLabel(message, me.id)}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {typingNames.length > 0 && <div className="typing">{typingNames.join(', ')} typing…</div>}
            </div>
            <form className="composer" onSubmit={(e) => void send(e)}>
              <input
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
                placeholder="Write a message"
                aria-label="Message"
                maxLength={4000}
              />
              <button className="btn primary" type="submit" disabled={!draft.trim() || sending}>
                Send
              </button>
            </form>
          </>
        )}
      </main>

      {profileOpen && (
        <div className="overlay" onClick={() => setProfileOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void saveProfile(e)}>
            <h2>Your profile</h2>
            <Avatar user={{ ...me, displayName }} />
            {profileError && <div className="banner error">{profileError}</div>}
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>
            <label className="file">
              {avatarBusy ? 'Uploading…' : 'Change photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/*"
                disabled={avatarBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void onAvatar(file);
                }}
              />
            </label>
            <label>
              Server
              <input
                defaultValue={getApiUrl() || window.location.origin}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== getApiUrl()) {
                    setApiUrl(next);
                    window.location.reload();
                  }
                }}
              />
            </label>
            <div className="actions">
              <button className="btn primary" type="submit">Save</button>
              {canInstall() && !isStandalone() && (
                <button className="btn" type="button" onClick={() => void promptInstall()}>Install app</button>
              )}
              <button className="btn" type="button" onClick={() => void logout()}>Log out</button>
            </div>
          </form>
        </div>
      )}

      {viewedUser && (
        <div className="overlay" onClick={() => setViewedUser(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <Avatar user={viewedUser} />
            <h2>{viewedUser.displayName}</h2>
            <p>@{viewedUser.username}</p>
            {viewedUser.bio && <p>{viewedUser.bio}</p>}
            <button className="btn primary" type="button" onClick={() => { setViewedUser(null); void openDirect(viewedUser); }}>
              Message
            </button>
          </div>
        </div>
      )}

      {detailsOpen && active && (
        <ChatDetails
          conversation={active}
          meId={me.id}
          people={people}
          query={query}
          onQuery={setQuery}
          onClose={() => setDetailsOpen(false)}
          onUpdated={(next) => setConversations((curr) => curr.map((c) => (c.id === next.id ? next : c)))}
          onLeft={() => {
            setDetailsOpen(false);
            navigate('/');
            void loadConversations();
          }}
        />
      )}

      {friendsOpen && (
        <FriendsPanel
          meId={me.id}
          onClose={() => setFriendsOpen(false)}
          onMessage={(person) => void openDirect(person)}
        />
      )}

      {groupOpen && (
        <div className="overlay" onClick={() => setGroupOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void createGroup(e)}>
            <h2>New group</h2>
            <label>
              Group name
              <input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} required />
            </label>
            <label>
              Add people
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search usernames" />
            </label>
            <div className="picks">
              {groupPicks.map((p) => (
                <button key={p.id} type="button" onClick={() => setGroupPicks((curr) => curr.filter((x) => x.id !== p.id))}>
                  {p.displayName} ×
                </button>
              ))}
            </div>
            {people.map((person) => (
              <button key={person.id} className="row" type="button" onClick={() => setGroupPicks((curr) => curr.some((p) => p.id === person.id) ? curr : [...curr, person])}>
                <Avatar user={person} />
                <span>{person.displayName}</span>
              </button>
            ))}
            <button className="btn primary" type="submit" disabled={groupPicks.length === 0 || !groupTitle.trim()}>
              Create group
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, online }: { user: PublicUser; online?: boolean }) {
  const src = useMediaSrc(user.avatarUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  return (
    <span className={`avatar ${online ? 'online' : ''}`}>
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} />
      ) : (
        initials(user.displayName || user.username)
      )}
    </span>
  );
}
