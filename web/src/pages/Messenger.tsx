import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getApiUrl, setApiUrl, toUploadPath } from '../lib/api';
import { compressImage } from '../lib/compress';
import { useMediaSrc } from '../lib/media';
import { canInstall, isStandalone, promptInstall } from '../lib/install';
import { useAuth } from '../lib/auth';
import { formatDayLabel, formatTime, groupMessages, initials, newClientId, receiptLabel, sameCalendarDay } from '../lib/messages';
import { connectSocket, joinConversation } from '../lib/socket';
import { EMOJIS } from '../lib/emojis';
import type { ChatMessage, Conversation, PublicUser } from '../lib/types';
import { ChatDetails } from './ChatDetails';
import { FriendsPanel } from './FriendsPanel';
import { useWebRTC } from '../lib/useWebRTC';
import { CallOverlay } from '../components/CallOverlay';
import { CustomizationPanel, applySavedCustomProperties, clearCustomProperties } from '../components/CustomizationPanel';

type PresenceMap = Record<string, { isOnline: boolean; lastSeenAt?: string | null }>;

export function Messenger() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const me = user!;

  const webrtc = useWebRTC(me);

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
  const [groupCallPicker, setGroupCallPicker] = useState<'voice' | 'video' | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [fileInput, setFileInput] = useState<'image' | 'video' | 'file' | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [imageBusy, setImageBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactMenuId, setReactMenuId] = useState<string | null>(null);
  const [reactAllOpen, setReactAllOpen] = useState(false);
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
  const [lightMode, setLightMode] = useState(() => {
    const ver = 'imx-ui-v5';
    if (localStorage.getItem('imx.ui.ver') !== ver) {
      localStorage.removeItem('imx_custom');
      localStorage.setItem('imx.ui.ver', ver);
      localStorage.setItem('imx.light', '1');
      return true;
    }
    return localStorage.getItem('imx.light') !== '0';
  });
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<Array<{ id: string; type: string; title: string; body?: string; read: boolean; createdAt: string }>>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', lightMode);
    localStorage.setItem('imx.light', lightMode ? '1' : '0');
    if (lightMode) clearCustomProperties();
    else applySavedCustomProperties();
  }, [lightMode]);

  useEffect(() => {
    if (localStorage.getItem('imx.light') === '1') return;
    applySavedCustomProperties();
  }, []);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef<number>();
  const typingAnnounced = useRef(false);
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
    void api.unreadNotificationCount().then((r) => setNotifCount(r.count)).catch(() => {});
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ }
  }, []);

  useEffect(() => {
    setReactMenuId(null);
    setReactAllOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (!reactMenuId) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.react-picker') || target.closest('[data-react-trigger]')) return;
      setReactMenuId(null);
      setReactAllOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [reactMenuId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (webrtc.callState !== 'idle') return;
      if (customOpen) return;
      if (lightboxSrc) { setLightboxSrc(null); setLightboxZoom(1); lightboxPos.current = { x: 0, y: 0 }; return; }
      if (groupCallPicker) { setGroupCallPicker(null); return; }
      if (forwardMsg) { setForwardMsg(null); return; }
      if (groupOpen) { setGroupOpen(false); return; }
      if (friendsOpen) { setFriendsOpen(false); return; }
      if (detailsOpen) { setDetailsOpen(false); return; }
      if (viewedUser) { setViewedUser(null); return; }
      if (profileOpen) { setProfileOpen(false); return; }
      if (notifsOpen) { setNotifsOpen(false); return; }
      if (settingsOpen) { setSettingsOpen(false); return; }
      if (emojiOpen) { setEmojiOpen(false); return; }
      if (reactMenuId) { setReactMenuId(null); setReactAllOpen(false); return; }
      if (searchOpen) { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); return; }
      if (replyTo || editingId) { setReplyTo(null); setEditingId(null); if (editingId) setDraft(''); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [webrtc.callState, customOpen, lightboxSrc, groupCallPicker, forwardMsg, groupOpen, friendsOpen, detailsOpen, viewedUser, profileOpen, notifsOpen, settingsOpen, emojiOpen, reactMenuId, searchOpen, replyTo, editingId]);

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
        try {
          if (navigator.userAgent.includes('Android') && (window as any).Capacitor) {
            const bodyText = payload.body
              ?? (payload.type === 'IMAGE' ? '📷 Photo'
                : payload.type === 'VIDEO' ? '🎬 Video'
                : payload.type === 'AUDIO' ? '🎤 Voice message'
                : 'New message');
            import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
              LocalNotifications.requestPermissions();
              LocalNotifications.schedule({
                notifications: [{
                  title: payload.sender.displayName,
                  body: bodyText,
                  id: Math.floor(Math.random() * 100000),
                }],
              });
            });
          }
        } catch { /* unsupported */ }
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
      setMessages((curr) => curr.map((m) => (m.id === p.id ? { ...m, body: null, deletedAt: new Date().toISOString() } : m)));
    };
    const onReactions = (p: { messageId: string; reactions: Record<string, Array<{ id: string; userId: string; username: string; displayName: string }>> }) => {
      setMessages((curr) => curr.map((m) => (m.id === p.messageId ? { ...m, reactions: p.reactions } : m)));
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

    const onNotifNew = (n: { id: string; type: string; title: string; body?: string; read: boolean; createdAt: string }) => {
      setNotifCount((c) => c + 1);
      setNotifList((curr) => [n, ...curr]);
      try {
        if (navigator.userAgent.includes('Android') && (window as any).Capacitor) {
          import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
            LocalNotifications.requestPermissions();
            LocalNotifications.schedule({
              notifications: [{
                title: n.title,
                body: n.body ?? '',
                id: Math.floor(Math.random() * 100000),
              }],
            });
          });
        }
      } catch { /* unsupported */ }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('notification:new', onNotifNew);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:read', onRead);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('message:reactions', onReactions);
    socket.on('presence:update', onPresence);
    socket.on('presence:snapshot', onSnapshot);
    if (socket.connected) setConnected(true);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('notification:new', onNotifNew);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('message:read', onRead);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('message:reactions', onReactions);
      socket.off('presence:update', onPresence);
      socket.off('presence:snapshot', onSnapshot);
    };
  }, [conversationId, loadConversations, me.id]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setTyping({});
      return;
    }
    setTyping({});
    typingAnnounced.current = false;
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
    let list = q ? conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q)) : conversations;
    const seen = new Set<string>();
    return list.filter((c) => {
      if (c.type !== 'DIRECT') return true;
      const peerId = c.members.find((m) => m.id !== me.id)?.id;
      if (!peerId) return true;
      const key = peerId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [conversations, query, me.id]);

  const groups = useMemo(() => groupMessages(messages), [messages]);
  const msgMap = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
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
    setQuery('');
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
      const compressed = await compressImage(file);
      const uploaded = await api.upload(compressed);
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

  async function sendFile(file: File) {
    if (!conversationId) return;
    setImageBusy(true);
    setChatError(null);
    try {
      const uploaded = await api.upload(file);
      const clientMessageId = newClientId();
      const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
      const attachments = [{ url: toUploadPath(uploaded.url), kind, fileName: uploaded.fileName, mimeType: uploaded.mimeType, size: uploaded.size }];
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        body: null,
        type: kind.toUpperCase() as any,
        status: 'SENT',
        sender: me,
        conversationId,
        createdAt: new Date().toISOString(),
        readBy: [],
        attachments: [{ id: clientMessageId, url: toUploadPath(uploaded.url), kind, fileName: uploaded.fileName }],
      };
      setMessages((curr) => [...curr, optimistic]);
      stickToBottom.current = true;
      const res = await api.sendMessage(conversationId, '', clientMessageId, attachments);
      setMessages((curr) =>
        curr.map((m) => (m.clientMessageId === clientMessageId ? { ...res.message, clientMessageId } : m)),
      );
      void loadConversations();
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'File send failed');
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
    if (!typingAnnounced.current) {
      typingAnnounced.current = true;
      socket.emit('typing:start', { conversationId });
    }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      typingAnnounced.current = false;
      socket.emit('typing:stop', { conversationId });
    }, 1200);
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
      const compressed = await compressImage(file, 512, 0.85);
      const uploaded = await api.upload(compressed);
      const res = await api.updateMe({ avatarUrl: toUploadPath(uploaded.url) });
      setUser(res.user);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Could not update photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🔥'];

  async function toggleReaction(messageId: string, emoji: string) {
    if (!conversationId) return;
    const msg = messages.find((m) => m.id === messageId);
    const myReactions = msg?.reactions?.[emoji] ?? [];
    const hasReacted = myReactions.some((r) => r.userId === me.id);
    try {
      if (hasReacted) {
        const res = await api.removeReaction(conversationId, messageId, emoji);
        setMessages((curr) => curr.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m)));
      } else {
        const res = await api.addReaction(conversationId, messageId, emoji);
        setMessages((curr) => curr.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m)));
      }
    } catch {}
  }

  function openReactMenu(messageId: string, expandAll = false) {
    setReactMenuId((id) => {
      if (id === messageId && !expandAll) {
        setReactAllOpen(false);
        return null;
      }
      setReactAllOpen(expandAll);
      return messageId;
    });
  }

  function pickReaction(messageId: string, emoji: string) {
    void toggleReaction(messageId, emoji);
    setReactMenuId(null);
    setReactAllOpen(false);
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
        backgroundImage: lightMode
          ? `linear-gradient(rgba(245,247,250,0.82), rgba(245,247,250,0.9)), url("${backgroundSrc}")`
          : `linear-gradient(rgba(14,20,24,0.62), rgba(14,20,24,0.72)), url("${backgroundSrc}")`,
      }
    : undefined;

  return (
    <div className={`shell ${conversationId ? 'chat-open' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="mobile-menu" type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <aside className="sidebar">
        <header className="sidebar-head">
          <div className="brand compact">
            <span className="logo-mark" />
            <span className="brand-text">IMX</span>
          </div>
          <div className={`sidebar-settings ${settingsOpen ? 'open' : ''}`}>
            <button
              className="icon-btn settings-trigger"
              type="button"
              aria-label="Settings menu"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <IconSettings />
              {notifCount > 0 && !settingsOpen && (
                <span className="notif-badge">{notifCount > 99 ? '99+' : notifCount}</span>
              )}
            </button>
            {settingsOpen && (
              <>
                <button className="settings-backdrop" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
                <div className="settings-menu" role="menu" aria-label="Settings">
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setLightMode((v) => !v);
                      setSettingsOpen(false);
                    }}
                  >
                    {lightMode ? <IconMoon /> : <IconSun />}
                    <span>{lightMode ? 'Dark mode' : 'Light mode'}</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setCustomOpen(true);
                    }}
                  >
                    <IconPalette />
                    <span>Customize UI</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setNotifsOpen(true);
                      api.notifications().then((r) => setNotifList(r.notifications)).catch(() => {});
                      api.markNotificationsRead().then(() => setNotifCount(0)).catch(() => {});
                    }}
                  >
                    <IconBell />
                    <span>Notifications</span>
                    {notifCount > 0 && <em className="settings-count">{notifCount > 99 ? '99+' : notifCount}</em>}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setFriendsOpen(true);
                    }}
                  >
                    <IconUsers />
                    <span>Friends</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setGroupOpen(true);
                    }}
                  >
                    <IconPlus />
                    <span>New group</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="settings-item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setProfileOpen(true);
                    }}
                  >
                    <IconUser />
                    <span>Your profile</span>
                  </button>
                </div>
              </>
            )}
          </div>
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
            <div className="empty">
              <div className="empty-icon" aria-hidden><IconChat /></div>
              No conversations yet. Search for someone to start one.
            </div>
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
                onClick={() => { navigate(`/c/${conv.id}`); setSidebarOpen(false); }}
              >
                <Avatar user={other ?? { id: conv.id, username: name, displayName: name, avatarUrl: conv.imageUrl }} online={!!online && conv.type === 'DIRECT'} />
                <span className="grow">
                  <strong>{name}</strong>
                  <small>{conv.lastMessage?.body ?? 'No messages yet'}</small>
                </span>
                <span className="meta">
                  <time>{formatTime(conv.lastMessageAt)}</time>
                  {conv.pinned && <span className="pin" title="Pinned" aria-label="Pinned"><IconPin /></span>}
                  {conv.muted ? <small className="muted-tag">Muted</small> : conv.unreadCount > 0 && <em>{conv.unreadCount}</em>}
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
          <div className="empty center welcome-screen">
            <p className="welcome-kicker">Inbox</p>
            <h2 className="welcome-brand">IMX</h2>
            <p className="welcome-lead">Pick a chat, or find someone new.</p>
            <div className="welcome-actions">
              <button className="btn primary" type="button" onClick={() => setFriendsOpen(true)}>
                <IconUsers /> Find friends
              </button>
              <button className="btn" type="button" onClick={() => setCustomOpen(true)}>
                Customize
              </button>
            </div>
          </div>
        )}
        {conversationId && (
          <>
            <header className="chat-head">
              <button className="icon-btn back" type="button" onClick={() => { navigate('/'); setSidebarOpen(true); }} aria-label="Back">
                <IconBack />
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
              <button
                className="icon-btn call-btn-header"
                type="button"
                onClick={() => {
                  if (!conversationId) return;
                  if (peer) {
                    webrtc.startCall(conversationId, peer.id, peer.displayName, peer.avatarUrl, 'voice');
                  } else if (active?.type === 'GROUP') {
                    setGroupCallPicker('voice');
                  }
                }}
                aria-label="Voice call"
                disabled={webrtc.callState !== 'idle'}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              </button>
              <button
                className="icon-btn call-btn-header"
                type="button"
                onClick={() => {
                  if (!conversationId) return;
                  if (peer) {
                    webrtc.startCall(conversationId, peer.id, peer.displayName, peer.avatarUrl, 'video');
                  } else if (active?.type === 'GROUP') {
                    setGroupCallPicker('video');
                  }
                }}
                aria-label="Video call"
                disabled={webrtc.callState !== 'idle'}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </button>
              <button className="icon-btn" type="button" onClick={() => setDetailsOpen(true)} aria-label="Chat settings">
                <IconMore />
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
              {!chatLoading && messages.length === 0 && (
                <div className="empty">
                  <div className="empty-icon" aria-hidden><IconChat /></div>
                  Say hello — this thread is empty.
                </div>
              )}
              {groups.map((group, groupIndex) => {
                const mine = group.senderId === me.id;
                const firstAt = group.messages[0].createdAt;
                const prevAt = groupIndex > 0 ? groups[groupIndex - 1].messages[0].createdAt : null;
                const showDay = !prevAt || !sameCalendarDay(prevAt, firstAt);
                return (
                  <div key={group.messages[0].id}>
                    {showDay && (
                      <div className="day-sep"><span>{formatDayLabel(firstAt)}</span></div>
                    )}
                  <div className={`bundle ${mine ? 'mine' : ''}`}>
                    {!mine && <Avatar user={group.sender} />}
                    <div className="stack">
                      {!mine && <span className="who">{group.sender.displayName}</span>}
                      {group.messages.map((message, index) => {
                          const quoted = message.replyToId ? msgMap.get(message.replyToId) ?? null : null;
                        const isDeleted = message.body === null && (message.attachments?.length ?? 0) === 0;
                        return (
                        <div
                          id={`msg-${message.id}`}
                          key={message.id}
                          className={`msg-unit ${mine ? 'mine' : ''} ${reactMenuId === message.id ? 'reacting' : ''}`}
                        >
                        <div className={`bubble ${message.type === 'IMAGE' ? 'has-image' : ''} ${message.type === 'AUDIO' ? 'has-audio' : ''} ${message.type === 'VIDEO' ? 'has-video' : ''}`}>
                          {message.replyToId && (
                            <button className="quote" type="button" onClick={() => { const el = document.getElementById(`msg-${message.replyToId}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                              <strong>{quoted?.sender.displayName ?? 'Original message'}</strong>
                              <span>{quoted?.body ?? (quoted?.attachments?.length ? '📎 Attachment' : 'Original message')}</span>
                            </button>
                          )}
                          <div className="msg-actions">
                            <button
                              type="button"
                              title="React"
                              aria-label="React"
                              data-react-trigger
                              className={`react-btn ${reactMenuId === message.id ? 'active' : ''}`}
                              onClick={() => openReactMenu(message.id)}
                            >
                              <IconReact />
                            </button>
                            <button type="button" title="Reply" aria-label="Reply" onClick={() => setReplyTo(message)}><IconReply /></button>
                            {message.sender.id === me.id && !isDeleted && message.body && (
                              <>
                                <button type="button" title="Edit" aria-label="Edit" onClick={() => { setEditingId(message.id); setDraft(message.body ?? ''); }}><IconEdit /></button>
                                <button
                                  type="button"
                                  className="danger"
                                  title="Delete"
                                  aria-label="Delete"
                                  onClick={() => {
                                    if (!window.confirm('Delete this message?')) return;
                                    void api.deleteMessage(conversationId!, message.id)
                                      .then(() => setMessages((curr) => curr.map((m) => (m.id === message.id ? { ...m, body: null, deletedAt: new Date().toISOString() } : m))))
                                      .catch((err) => setChatError(err instanceof ApiError ? err.message : 'Could not delete message'));
                                  }}
                                ><IconTrash /></button>
                              </>
                            )}
                            <button type="button" title="Forward" aria-label="Forward" onClick={() => setForwardMsg(message)}><IconForward /></button>
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
                          {message.body && <p>{message.body}{message.edited && <em className="edited-mark"> · edited</em>}</p>}
                          {!message.body && (message.attachments?.length ?? 0) === 0 && <p className="deleted">This message was deleted</p>}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="reactions-row">
                              {Object.entries(message.reactions).map(([emoji, users]) => {
                                const hasReacted = users.some((u) => u.userId === me.id);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`reaction-chip ${hasReacted ? 'mine' : ''}`}
                                    onClick={() => toggleReaction(message.id, emoji)}
                                    title={users.map((u) => u.displayName).join(', ')}
                                  >
                                    <span>{emoji}</span>
                                    <em>{users.length}</em>
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className="reaction-add"
                                data-react-trigger
                                aria-label="Add reaction"
                                onClick={() => openReactMenu(message.id, true)}
                              >
                                +
                              </button>
                            </div>
                          )}
                            </>
                          )}
                          {index === group.messages.length - 1 && (
                            <span className="stamp">
                              {formatTime(message.createdAt)}
                              {mine && ` · ${receiptLabel(message, me.id)}`}
                            </span>
                          )}
                        </div>
                        {reactMenuId === message.id && (
                          <div className={`react-picker ${reactAllOpen ? 'expanded' : ''} ${mine ? 'mine' : ''}`} role="dialog" aria-label="Add reaction">
                            <div className="react-quick">
                              {QUICK_REACTIONS.map((emoji) => {
                                const on = message.reactions?.[emoji]?.some((u) => u.userId === me.id) ?? false;
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`react-quick-btn ${on ? 'on' : ''}`}
                                    aria-pressed={on}
                                    title={emoji}
                                    onClick={() => pickReaction(message.id, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                              <span className="react-quick-sep" aria-hidden="true" />
                              <button
                                type="button"
                                className={`react-quick-more ${reactAllOpen ? 'open' : ''}`}
                                aria-label="More emojis"
                                aria-expanded={reactAllOpen}
                                onClick={() => setReactAllOpen((v) => !v)}
                              >
                                +
                              </button>
                            </div>
                            {reactAllOpen && (
                              <div className="react-all">
                                <p className="react-all-label">All emojis</p>
                                <div className="react-all-grid">
                                  {EMOJIS.map((e) => {
                                    const on = message.reactions?.[e]?.some((u) => u.userId === me.id) ?? false;
                                    return (
                                      <button
                                        key={e}
                                        type="button"
                                        className={`emoji-btn ${on ? 'on' : ''}`}
                                        aria-pressed={on}
                                        onClick={() => pickReaction(message.id, e)}
                                      >
                                        {e}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                );
              })}
              {typingNames.length > 0 && (
                <div className="typing">
                  <span className="typing-dots" aria-hidden><i /><i /><i /></span>
                  {typingNames.join(', ')} typing…
                </div>
              )}
            </div>
            <div className="chat-bottom">
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
                    <IconClose />
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
                    <IconClose />
                  </button>
                </div>
              )}
            <form className={`composer ${draft.trim() ? 'has-draft' : ''}`} onSubmit={(e) => void send(e)}>
              <button
                className={`icon-btn ${searchOpen ? 'active' : ''}`}
                type="button"
                aria-label="Search messages"
                onClick={() => setSearchOpen((o) => !o)}
              >
                <IconSearch />
              </button>
              <input
                ref={imageInput}
                type="file"
                accept="*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    if (file.type.startsWith('image/')) void sendImage(file);
                    else if (file.type.startsWith('video/')) void sendVideo(file);
                    else void sendFile(file);
                  }
                }}
              />
              <button
                className={`icon-btn ${emojiOpen ? 'active' : ''}`}
                type="button"
                aria-label="Emoji"
                onClick={() => setEmojiOpen((o) => !o)}
              >
                <IconEmoji />
              </button>
              <button
                className="icon-btn"
                type="button"
                disabled={imageBusy}
                aria-label="Send file"
                onClick={() => imageInput.current?.click()}
              >
                {imageBusy ? '…' : <IconImage />}
              </button>
              <input
                ref={videoInput}
                type="file"
                accept="*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) {
                    if (file.type.startsWith('image/')) void sendImage(file);
                    else if (file.type.startsWith('video/')) void sendVideo(file);
                    else void sendFile(file);
                  }
                }}
              />
              <button
                className="icon-btn"
                type="button"
                disabled={imageBusy}
                aria-label="Send video"
                onClick={() => videoInput.current?.click()}
              >
                {imageBusy ? '…' : <IconVideo />}
              </button>
              <button
                className={`icon-btn ${recording ? 'recording' : ''}`}
                type="button"
                aria-label={recording ? 'Stop recording' : 'Record voice'}
                onClick={() => recording ? stopRecording() : startRecording()}
              >
                {recording ? <IconStop /> : <IconMic />}
              </button>
              <textarea
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim() && !sending) e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Write a message"
                aria-label="Message"
                maxLength={4000}
                rows={1}
              />
              <button className="btn primary send-btn" type="submit" disabled={!draft.trim() || sending}>
                Send
              </button>
            </form>
            </div>
          </>
        )}
      </main>

      {profileOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Your profile" onClick={() => setProfileOpen(false)}>
          <form className="sheet profile-sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void saveProfile(e)}>
            <div className="profile-hero">
              <button className="icon-btn profile-x" type="button" onClick={() => setProfileOpen(false)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
              <div className="profile-hero-av">
                <Avatar user={{ ...me, displayName }} />
                <label className="profile-photo-btn">
                  {avatarBusy ? '…' : 'Edit'}
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
              </div>
              <p className="profile-handle">@{me.username}</p>
            </div>
            <div className="profile-body">
              <h2>Your profile</h2>
              {profileError && <div className="banner error">{profileError}</div>}
              <label className="profile-field">
                Display name
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </label>
              <label className="profile-field">
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
              <div className="profile-actions">
                <button className="btn primary" type="submit">Save changes</button>
                {canInstall() && !isStandalone() && (
                  <button className="btn" type="button" onClick={() => void promptInstall()}>Install app</button>
                )}
                <button className="btn ghost-danger" type="button" onClick={() => void logout()}>Log out</button>
              </div>
              <p className="profile-build">IMX · panel v5</p>
            </div>
          </form>
        </div>
      )}

      {viewedUser && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="User profile" onClick={() => setViewedUser(null)}>
          <div className="sheet person-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn person-x" type="button" onClick={() => setViewedUser(null)} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <div className="person-banner" aria-hidden="true" />
            <div className="person-av-wrap">
              <Avatar user={viewedUser} />
            </div>
            <div className="person-meta">
              <h2>{viewedUser.displayName}</h2>
              <span className="person-chip">@{viewedUser.username}</span>
              {viewedUser.bio && <p className="person-bio">{viewedUser.bio}</p>}
            </div>
            <button
              className="btn primary person-cta"
              type="button"
              onClick={() => { setViewedUser(null); void openDirect(viewedUser); }}
            >
              Start chat
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
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="new-group-title" onClick={() => setGroupOpen(false)}>
          <form className="sheet group-sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void createGroup(e)}>
            <header className="group-head">
              <div>
                <p className="group-kicker">Create</p>
                <h2 id="new-group-title">New group</h2>
              </div>
              <button className="icon-btn" type="button" onClick={() => setGroupOpen(false)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </header>

            <div className="group-preview" aria-hidden="true">
              <div className="group-preview-stack">
                {groupPicks.slice(0, 4).map((p) => (
                  <span key={p.id} className="group-preview-av">
                    <Avatar user={p} />
                  </span>
                ))}
                {groupPicks.length === 0 && <span className="group-preview-empty"><IconUsers /></span>}
              </div>
              <div className="group-preview-meta">
                <strong>{groupTitle.trim() || 'Untitled group'}</strong>
                <small>
                  {groupPicks.length === 0
                    ? 'Add at least one person'
                    : `${groupPicks.length} member${groupPicks.length === 1 ? '' : 's'} selected`}
                </small>
              </div>
            </div>

            <label className="group-field">
              Group name
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Weekend plans"
                required
                autoFocus
              />
            </label>

            <section className="group-section">
              <div className="group-section-head">
                <h3>Members</h3>
                {groupPicks.length > 0 && <span>{groupPicks.length}</span>}
              </div>
              {groupPicks.length > 0 && (
                <div className="group-chips">
                  {groupPicks.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="group-chip"
                      onClick={() => setGroupPicks((curr) => curr.filter((x) => x.id !== p.id))}
                      aria-label={`Remove ${p.displayName}`}
                    >
                      <Avatar user={p} />
                      <span>{p.displayName}</span>
                      <em aria-hidden="true">×</em>
                    </button>
                  ))}
                </div>
              )}
              <label className="group-field">
                Add people
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search usernames"
                  aria-label="Search people to add"
                />
              </label>
              <div className="group-people">
                {query.trim() && people.length === 0 && (
                  <p className="group-empty">No users match “{query.trim()}”</p>
                )}
                {!query.trim() && (
                  <p className="group-empty">Type a username to find people</p>
                )}
                {people.map((person) => {
                  const picked = groupPicks.some((p) => p.id === person.id);
                  return (
                    <button
                      key={person.id}
                      className={`group-person ${picked ? 'picked' : ''}`}
                      type="button"
                      onClick={() =>
                        setGroupPicks((curr) =>
                          curr.some((p) => p.id === person.id)
                            ? curr.filter((p) => p.id !== person.id)
                            : [...curr, person],
                        )
                      }
                    >
                      <Avatar user={person} />
                      <span className="pref-copy">
                        <strong>{person.displayName}</strong>
                        <small>@{person.username}</small>
                      </span>
                      <span className="group-person-action">{picked ? 'Added' : 'Add'}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <footer className="group-foot">
              <button className="btn" type="button" onClick={() => setGroupOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={groupPicks.length === 0 || !groupTitle.trim()}>
                Create group
              </button>
            </footer>
          </form>
        </div>
      )}

      {forwardMsg && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Forward message" onClick={() => setForwardMsg(null)}>
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
            <IconClose />
          </button>
          <div className="lightbox-hint">Scroll to zoom · Drag to pan · Double-click to reset</div>
        </div>
      )}
      {notifsOpen && (
        <>
          <div className="notif-backdrop" onClick={() => setNotifsOpen(false)} />
          <aside className="notif-slide-panel open" role="dialog" aria-modal="true" aria-label="Notifications">
            <div className="notif-slide-head">
              <h3>Notifications</h3>
              <div className="actions">
                <button className="text-btn" type="button" onClick={() => {
                  api.markNotificationsRead().then(() => setNotifCount(0)).catch(() => {});
                  setNotifList((curr) => curr.map((n) => ({ ...n, read: true })));
                }}>Mark all read</button>
                <button className="icon-btn" type="button" aria-label="Close notifications" onClick={() => setNotifsOpen(false)}>
                  <IconClose />
                </button>
              </div>
            </div>
            <div className="notif-slide-body">
              {notifList.length === 0 ? (
                <p className="notif-empty">No notifications yet</p>
              ) : (
                notifList.map((n) => (
                  <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                    <div className="notif-icon">
                      {n.type === 'FRIEND_REQUEST' ? '👤' : n.type === 'FRIEND_ACCEPTED' ? '✅' : n.type === 'INCOMING_CALL' ? '📞' : '💬'}
                    </div>
                    <div className="notif-content">
                      <strong>{n.title}</strong>
                      {n.body && <p>{n.body}</p>}
                    </div>
                    <span className="meta"><time>{formatTime(n.createdAt)}</time></span>
                  </div>
                ))
              )}
            </div>
          </aside>
        </>
      )}
      {groupCallPicker && active?.type === 'GROUP' && (
        <div className="call-overlay incoming" onClick={() => setGroupCallPicker(null)}>
          <div className="call-incoming-card" onClick={(e) => e.stopPropagation()}>
            <h2>Call a member</h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 16px' }}>Select who to {groupCallPicker === 'voice' ? 'voice' : 'video'} call</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', width: '100%' }}>
              {active.members.filter((m) => m.id !== me.id).map((m) => (
                <button
                  key={m.id}
                  className="row"
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '10px 16px', color: 'var(--text)', cursor: 'pointer', gap: 12 }}
                  onClick={() => {
                    if (!conversationId) return;
                    webrtc.startCall(conversationId, m.id, m.displayName, m.avatarUrl, groupCallPicker);
                    setGroupCallPicker(null);
                  }}
                >
                  <Avatar user={m} />
                  <span>{m.displayName}</span>
                </button>
              ))}
            </div>
            <button className="call-action call-reject" style={{ marginTop: 16 }} onClick={() => setGroupCallPicker(null)}>Cancel</button>
          </div>
        </div>
      )}
      <CallOverlay
        callState={webrtc.callState}
        callInfo={webrtc.callInfo}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        muted={webrtc.muted}
        videoOff={webrtc.videoOff}
        callError={webrtc.callError}
        callDuration={webrtc.callDuration}
        onAccept={() => {
          const offer = (window as any).__pendingCallOffer as RTCSessionDescriptionInit | undefined;
          const peerId = (window as any).__pendingCallPeerId as string | undefined;
          const convId = (window as any).__pendingCallConvId as string | undefined;
          if (offer && convId && peerId && webrtc.callInfo) {
            webrtc.acceptCall(convId, peerId, webrtc.callInfo.peerName, webrtc.callInfo.peerAvatar, offer, webrtc.callInfo.mode);
            (window as any).__pendingCallOffer = null;
          }
        }}
        onReject={() => {
          if (webrtc.callInfo) webrtc.rejectCall(webrtc.callInfo.conversationId);
        }}
        onEnd={() => {
          if (webrtc.callInfo) webrtc.endCall(webrtc.callInfo.conversationId);
        }}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
        onToggleScreenShare={webrtc.toggleScreenShare}
        screenSharing={webrtc.screenSharing}
      />
      <CustomizationPanel isOpen={customOpen} onClose={() => setCustomOpen(false)} me={me} />
    </div>
  );
}

const Avatar = React.memo(function Avatar({ user, online }: { user: PublicUser; online?: boolean }) {
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
});

const MsgImage = React.memo(function MsgImage({ url, fileName, onOpen }: { url: string; fileName?: string | null; onOpen?: (src: string) => void }) {
  const src = useMediaSrc(url);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [src]);
  if (broken) return <div className="msg-image-fallback">Couldn't load image</div>;
  if (!src) return <div className="msg-image-fallback">Unsupported attachment</div>;
  return (
    <img
      className={`msg-image ${loaded ? 'loaded' : 'loading'}`}
      src={src}
      alt={fileName ?? 'image'}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onClick={() => onOpen?.(src)}
      onError={() => setBroken(true)}
    />
  );
});

const MsgAudio = React.memo(function MsgAudio({ url }: { url: string }) {
  const src = useMediaSrc(url);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  if (!src) return <div className="msg-image-fallback">Couldn't load audio</div>;

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  }

  function onSliderClick(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (a && duration) { a.currentTime = pct * duration; setCurrent(pct * duration); }
  }

  function onSliderDown(e: React.MouseEvent<HTMLDivElement>) {
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragX(pct);
    function onMove(ev: MouseEvent) {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      setDragX(p);
    }
    function onUp(ev: MouseEvent) {
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const a = audioRef.current;
      if (a && duration) { a.currentTime = p * duration; setCurrent(p * duration); }
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const pct = duration > 0 ? (dragging ? dragX * 100 : (current / duration) * 100) : 0;

  return (
    <div className="wa-audio">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onTimeUpdate={() => { if (audioRef.current && !dragging) setCurrent(audioRef.current.currentTime); }}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        style={{ display: 'none' }}
      />
      <button className="wa-audio-play" type="button" onClick={togglePlay}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <span className="wa-audio-time">{fmt(current)}</span>
      <div className="wa-audio-slider" ref={sliderRef} onMouseDown={onSliderDown}>
        <div className="wa-audio-track">
          <div className="wa-audio-fill" style={{ width: `${pct}%` }} />
          <div className="wa-audio-thumb" style={{ left: `${pct}%` }} />
        </div>
      </div>
      <span className="wa-audio-time">{fmt(duration)}</span>
    </div>
  );
});

const MsgVideo = React.memo(function MsgVideo({ url }: { url: string; fileName?: string | null }) {
  const src = useMediaSrc(url);
  if (!src) return <div className="msg-image-fallback">Couldn't load video</div>;
  return <video className="msg-video" src={src} controls preload="metadata" playsInline />;
});

function iconProps(props?: SVGProps<SVGSVGElement>) {
  return { viewBox: '0 0 24 24', 'aria-hidden': true as const, ...props };
}

function IconSun() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg {...iconProps()}>
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg {...iconProps()}>
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...iconProps()}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg {...iconProps()}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.7.8 1.2 1.5 1.2H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg {...iconProps()}>
      <path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3 3h-1.5a2.5 2.5 0 0 0 0 5H12z" />
      <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg {...iconProps()}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconBack() {
  return (
    <svg {...iconProps()}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg {...iconProps()}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg {...iconProps()}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function IconEmoji() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg {...iconProps()}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg {...iconProps()}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg {...iconProps()}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function IconReact() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01" />
      <path d="M8.2 14.2a4.2 4.2 0 0 0 7.6 0" />
    </svg>
  );
}
function IconReply() {
  return (
    <svg {...iconProps()}>
      <path d="M9 14L4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg {...iconProps()}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg {...iconProps()}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
function IconForward() {
  return (
    <svg {...iconProps()}>
      <path d="M15 10l5-5-5-5" />
      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M14 4l6 6-3 1-4 7-2-2 1-5-5-5zM6 18l-2 4" fill="currentColor" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg {...iconProps()}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0z" />
    </svg>
  );
}
