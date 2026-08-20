import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getApiUrl, setApiUrl, toUploadPath } from '../lib/api';
import { useMediaSrc } from '../lib/media';
import { canInstall, isStandalone, promptInstall } from '../lib/install';
import { useAuth } from '../lib/auth';
import { formatTime, groupMessages, initials, newClientId, receiptLabel } from '../lib/messages';
import { connectSocket, joinConversation } from '../lib/socket';
import { EMOJIS } from '../lib/emojis';
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
  const [imageBusy, setImageBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const lightboxPos = useRef({ x: 0, y: 0 });
  const lightboxDrag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('imx.light') === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('light', lightMode);
    localStorage.setItem('imx.light', lightMode ? '1' : '0');
  }, [lightMode]);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef<number>();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

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
      if (document.visibilityState !== 'visible' && payload.sender.id !== me.id) {
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const title = payload.sender.displayName;
            const bodyText = payload.body
              ?? (payload.type === 'IMAGE' ? '📷 Photo'
                : payload.type === 'VIDEO' ? '🎬 Video'
                : payload.type === 'AUDIO' ? '🎤 Voice message'
                : 'New message');
            void new Notification(title, {
              body: bodyText,
              tag: `imx-${payload.conversationId}`,
              icon: '/icon-192.png',
            });
          }
        } catch {
          /* notifications unsupported */
        }
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
    const onEdited = (p: { id: string; body: string; conversationId: string; editedAt: string }) => {
      if (p.conversationId !== conversationId) return;
      setMessages((curr) =>
        curr.map((m) => (m.id === p.id ? { ...m, body: p.body, updatedAt: p.editedAt, edited: true } : m)),
      );
    };
    const onDeleted = (p: { id: string; conversationId: string }) => {
      if (p.conversationId !== conversationId) return;
      setMessages((curr) => curr.map((m) => (m.id === p.id ? { ...m, body: null, deletedAt: p.conversationId } : m)));
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
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
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
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
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

    if (editingId) {
      try {
        const res = await api.editMessage(conversationId, editingId, body);
        setMessages((curr) => curr.map((m) => (m.id === editingId ? { ...m, ...res.message, edited: true } : m)));
        setEditingId(null);
        setDraft('');
      } catch (err) {
        setChatError(err instanceof ApiError ? err.message : 'Edit failed');
      } finally {
        setSending(false);
      }
      return;
    }

    const clientMessageId = newClientId();
    const optimistic: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      body,
      type: 'TEXT',
      status: 'SENT',
      sender: me,
      conversationId,
      replyToId: replyTo?.id ?? null,
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    setMessages((curr) => [...curr, optimistic]);
    setDraft('');
    stickToBottom.current = true;
    connectSocket().emit('typing:stop', { conversationId });
    joinConversation(conversationId);
    try {
      const res = await api.sendMessage(conversationId, body, clientMessageId, undefined, replyTo?.id ?? null);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      setReplyTo(null);
      void loadConversations();
    } catch (err) {
      setMessages((curr) => curr.filter((m) => m.clientMessageId !== clientMessageId));
      setDraft(body);
      setChatError(err instanceof ApiError ? err.message : 'Message failed');
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    if (!conversationId) return;
    setImageBusy(true);
    setChatError(null);
    try {
      const uploaded = await api.upload(file);
      const clientMessageId = newClientId();
      const attachments = [{ url: toUploadPath(uploaded.url), kind: 'image', fileName: uploaded.fileName }];
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        body: null,
        type: 'IMAGE',
        status: 'SENT',
        sender: me,
        conversationId,
        createdAt: new Date().toISOString(),
        readBy: [],
        attachments: [{ id: clientMessageId, url: toUploadPath(uploaded.url), kind: 'image', fileName: uploaded.fileName }],
      };
      setMessages((curr) => [...curr, optimistic]);
      stickToBottom.current = true;
      const res = await api.sendMessage(conversationId, '', clientMessageId, attachments);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'Image send failed');
    } finally {
      setImageBusy(false);
    }
  }

  async function sendVideo(file: File) {
    if (!conversationId) return;
    setImageBusy(true);
    setChatError(null);
    try {
      const uploaded = await api.upload(file);
      const clientMessageId = newClientId();
      const attachments = [{ url: toUploadPath(uploaded.url), kind: 'video', fileName: uploaded.fileName, mimeType: uploaded.mimeType, size: uploaded.size }];
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        body: null,
        type: 'VIDEO',
        status: 'SENT',
        sender: me,
        conversationId,
        createdAt: new Date().toISOString(),
        readBy: [],
        attachments: [{ id: clientMessageId, url: toUploadPath(uploaded.url), kind: 'video', fileName: uploaded.fileName }],
      };
      setMessages((curr) => [...curr, optimistic]);
      stickToBottom.current = true;
      const res = await api.sendMessage(conversationId, '', clientMessageId, attachments);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'Video send failed');
    } finally {
      setImageBusy(false);
    }
  }

  function startRecording() {
    if (!conversationId) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setChatError('Recording not supported in this browser');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      if (!mimeType) {
        stream.getTracks().forEach((t) => t.stop());
        setChatError('No supported audio format found');
        return;
      }
      const mr = new MediaRecorder(stream, { mimeType });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void sendVoice();
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    }).catch((err) => {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied — allow it in browser settings'
        : err?.name === 'NotFoundError'
          ? 'No microphone found'
          : `Mic error: ${err?.message ?? err}`;
      setChatError(msg);
    });
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  async function sendVoice() {
    if (!conversationId || chunks.current.length === 0) return;
    setChatError(null);
    try {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
      const uploaded = await api.upload(file);
      const clientMessageId = newClientId();
      const attachments = [{ url: toUploadPath(uploaded.url), kind: 'audio', fileName: uploaded.fileName }];
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        body: null,
        type: 'AUDIO',
        status: 'SENT',
        sender: me,
        conversationId,
        createdAt: new Date().toISOString(),
        readBy: [],
        attachments: [{ id: clientMessageId, url: toUploadPath(uploaded.url), kind: 'audio', fileName: uploaded.fileName }],
      };
      setMessages((curr) => [...curr, optimistic]);
      stickToBottom.current = true;
      const res = await api.sendMessage(conversationId, '', clientMessageId, attachments);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'Voice send failed');
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

  async function forwardTo(convId: string) {
    const msg = forwardMsg;
    if (!msg || !conversationId) return;
    setForwardMsg(null);
    setChatError(null);
    try {
      const clientMessageId = newClientId();
      const body = msg.body ?? '';
      const attachments = msg.attachments?.map((a) => ({ url: a.url, kind: a.kind, fileName: a.fileName ?? undefined }));
      await api.sendMessage(convId, body, clientMessageId, attachments);
      if (convId === conversationId) {
        setMessages((curr) => [...curr, {
          id: clientMessageId,
          clientMessageId,
          body,
          type: msg.type,
          status: 'SENT',
          sender: me,
          conversationId,
          createdAt: new Date().toISOString(),
          readBy: [],
          attachments: msg.attachments,
        }]);
      }
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'Forward failed');
    }
  }

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (!conversationId || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchMessages(conversationId, q.trim());
      setSearchResults(res.messages);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
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
          <button className="icon-btn" type="button" onClick={() => { setLightMode((v) => !v); }} aria-label="Toggle light mode" title="Toggle light mode">
            {lightMode ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn" type="button" onClick={() => { void (async () => { try { await Notification.requestPermission(); } catch { /* unsupported */ } })(); }} aria-label="Enable notifications" title="Enable notifications">
            🔔
          </button>
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
                  {conv.pinned && <small>📌</small>}
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
                      {group.messages.map((message, index) => {
                        const quoted = message.replyToId ? messages.find((m) => m.id === message.replyToId) : null;
                        const isDeleted = message.body === null && (message.attachments?.length ?? 0) === 0;
                        return (
                        <div key={message.id} className={`bubble ${message.type === 'IMAGE' ? 'has-image' : ''} ${message.type === 'AUDIO' ? 'has-audio' : ''} ${message.type === 'VIDEO' ? 'has-video' : ''}`}>
                          {message.replyToId && (
                            <button className="quote" type="button" onClick={() => { const el = document.getElementById(`msg-${message.replyToId}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                              <strong>{quoted?.sender.displayName ?? 'Deleted message'}</strong>
                              <span>{quoted?.body ?? (quoted?.attachments?.length ? '📎 Attachment' : 'Message deleted')}</span>
                            </button>
                          )}
                          <div className="msg-actions">
                            <button type="button" title="Reply" onClick={() => setReplyTo(message)}>↩</button>
                            {message.sender.id === me.id && !isDeleted && message.body && (
                              <>
                                <button type="button" title="Edit" onClick={() => { setEditingId(message.id); setDraft(message.body ?? ''); }}>✎</button>
                                <button type="button" title="Delete" onClick={() => void api.deleteMessage(conversationId!, message.id).then(() => setMessages((curr) => curr.map((m) => (m.id === message.id ? { ...m, body: null } : m))))}>🗑</button>
                              </>
                            )}
                            <button type="button" title="Forward" onClick={() => setForwardMsg(message)}>→</button>
                          </div>
                          {isDeleted ? (
                            <p className="deleted">This message was deleted</p>
                          ) : (
                            <>
                          {message.attachments?.filter(a => a.kind.toLowerCase().includes('image')).map(a => (
                            <MsgImage key={a.id} url={a.url} fileName={a.fileName} onOpen={(s) => { setLightboxSrc(s); setLightboxZoom(1); lightboxPos.current = { x: 0, y: 0 }; }} />
                          ))}
                          {message.attachments?.filter(a => a.kind.toLowerCase().includes('video')).map(a => (
                            <MsgVideo key={a.id} url={a.url} fileName={a.fileName} />
                          ))}
                          {message.attachments?.filter(a => a.kind.toLowerCase().includes('audio')).map(a => (
                            <MsgAudio key={a.id} url={a.url} />
                          ))}
                          {message.body && <p id={`msg-${message.id}`}>{message.body}{message.edited && <em className="edited-mark"> · edited</em>}</p>}
                          {!message.body && (message.attachments?.length ?? 0) === 0 && <p id={`msg-${message.id}`} className="deleted">This message was deleted</p>}
                            </>
                          )}
                          {index === group.messages.length - 1 && (
                            <span className="stamp">
                              {formatTime(message.createdAt)}
                              {mine && ` · ${receiptLabel(message, me.id)}`}
                            </span>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {typingNames.length > 0 && <div className="typing">{typingNames.join(', ')} typing…</div>}
            </div>
            {emojiOpen && (
              <div className="emoji-grid">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" className="emoji-btn" onClick={() => { setDraft((d) => d + e); setEmojiOpen(false); }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {searchOpen && (
              <div className="msg-search">
                <input
                  value={searchQuery}
                  onChange={(e) => void doSearch(e.target.value)}
                  placeholder="Search in this chat…"
                  autoFocus
                />
                {searching && <small>Searching…</small>}
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                      >
                        <strong>{m.sender.displayName}</strong>
                        <span>{m.body ?? (m.type === 'IMAGE' ? '📷 Photo' : m.type === 'VIDEO' ? '🎬 Video' : m.type === 'AUDIO' ? '🎤 Voice' : 'Attachment')}</span>
                        <small>{formatTime(m.createdAt)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <small>No matches</small>
                )}
                <button className="icon-btn" type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}>
                  ✕
                </button>
              </div>
            )}
            {(replyTo || editingId) && (
              <div className="reply-bar">
                {editingId ? (
                  <span>Editing message…</span>
                ) : (
                  <span>
                    Replying to <strong>{replyTo?.sender.displayName}</strong>: {replyTo?.body ?? (replyTo?.attachments?.length ? '📎 Attachment' : '')}
                  </span>
                )}
                <button className="icon-btn" type="button" aria-label="Cancel" onClick={() => { setReplyTo(null); setEditingId(null); if (editingId) setDraft(''); }}>
                  ✕
                </button>
              </div>
            )}
            <form className="composer" onSubmit={(e) => void send(e)}>
              <button
                className={`icon-btn ${searchOpen ? 'active' : ''}`}
                type="button"
                aria-label="Search messages"
                onClick={() => setSearchOpen((o) => !o)}
              >
                🔍
              </button>
              <input
                ref={imageInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void sendImage(file);
                }}
              />
              <button
                className="icon-btn"
                type="button"
                aria-label="Emoji"
                onClick={() => setEmojiOpen((o) => !o)}
              >
                😊
              </button>
              <button
                className="icon-btn"
                type="button"
                disabled={imageBusy}
                aria-label="Send photo"
                onClick={() => imageInput.current?.click()}
              >
                {imageBusy ? '…' : '📷'}
              </button>
              <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void sendVideo(file);
                }}
              />
              <button
                className="icon-btn"
                type="button"
                disabled={imageBusy}
                aria-label="Send video"
                onClick={() => videoInput.current?.click()}
              >
                {imageBusy ? '…' : '🎬'}
              </button>
              <button
                className={`icon-btn ${recording ? 'recording' : ''}`}
                type="button"
                aria-label={recording ? 'Stop recording' : 'Record voice'}
                onClick={() => recording ? stopRecording() : startRecording()}
              >
                {recording ? '⏹' : '🎤'}
              </button>
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

      {forwardMsg && (
        <div className="overlay" onClick={() => setForwardMsg(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Forward to…</h2>
            <div className="conv-list">
              {conversations.filter((c) => c.id !== conversationId).map((conv) => {
                const name =
                  conv.type === 'GROUP'
                    ? conv.title ?? 'Group'
                    : conv.members.find((m) => m.id !== me.id)?.displayName ?? conv.title ?? 'Chat';
                return (
                  <button key={conv.id} className="row" type="button" onClick={() => void forwardTo(conv.id)}>
                    <Avatar user={conv.members.find((m) => m.id !== me.id) ?? { id: conv.id, username: name, displayName: name, avatarUrl: conv.imageUrl }} />
                    <span>
                      <strong>{name}</strong>
                      <small>Forward message</small>
                    </span>
                  </button>
                );
              })}
              {conversations.filter((c) => c.id !== conversationId).length === 0 && (
                <p className="empty">No other conversations</p>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxSrc && (
        <div
          className="lightbox"
          onClick={() => { setLightboxSrc(null); setLightboxZoom(1); lightboxPos.current = { x: 0, y: 0 }; }}
          onWheel={(e) => {
            e.preventDefault();
            setLightboxZoom((z) => Math.min(8, Math.max(1, z + (e.deltaY > 0 ? -0.25 : 0.25))));
          }}
          onMouseDown={(e) => { lightboxDrag.current = { startX: e.clientX, startY: e.clientY, x: lightboxPos.current.x, y: lightboxPos.current.y }; }}
          onMouseMove={(e) => {
            if (!lightboxDrag.current) return;
            lightboxPos.current = {
              x: lightboxDrag.current.x + (e.clientX - lightboxDrag.current.startX),
              y: lightboxDrag.current.y + (e.clientY - lightboxDrag.current.startY),
            };
          }}
          onMouseUp={() => { lightboxDrag.current = null; }}
          onMouseLeave={() => { lightboxDrag.current = null; }}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="lightbox-img"
            draggable={false}
            style={{
              transform: `translate(${lightboxPos.current.x}px, ${lightboxPos.current.y}px) scale(${lightboxZoom})`,
            }}
            onDoubleClick={() => { setLightboxZoom(1); lightboxPos.current = { x: 0, y: 0 }; }}
          />
          <button className="lightbox-close" type="button" onClick={(e) => { e.stopPropagation(); setLightboxSrc(null); setLightboxZoom(1); lightboxPos.current = { x: 0, y: 0 }; }}>
            ✕
          </button>
          <div className="lightbox-hint">Scroll to zoom · Drag to pan · Double-click to reset</div>
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

function MsgImage({ url, fileName, onOpen }: { url: string; fileName?: string | null; onOpen?: (src: string) => void }) {
  const src = useMediaSrc(url);
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="msg-image-fallback">Couldn't load image</div>;
  if (!src) return <div className="msg-image-fallback">Loading photo…</div>;
  return (
    <img
      className="msg-image"
      src={src}
      alt={fileName ?? 'image'}
      loading="lazy"
      onClick={() => onOpen?.(src)}
      onError={() => setBroken(true)}
    />
  );
}

function MsgAudio({ url }: { url: string }) {
  const src = useMediaSrc(url);
  if (!src) return <div className="msg-image-fallback">Loading audio…</div>;
  return <audio controls src={src} className="msg-audio" />;
}

function MsgVideo({ url, fileName }: { url: string; fileName?: string | null }) {
  const src = useMediaSrc(url);
  if (!src) return <div className="msg-image-fallback">Loading video…</div>;
  return (
    <video className="msg-video" src={src} controls preload="metadata" playsInline>
      <track kind="captions" />
    </video>
  );
}
