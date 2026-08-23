import type { ChatMessage, Conversation, PublicUser } from './types';

const TOKEN_KEY = 'cove.accessToken';
const REFRESH_KEY = 'cove.refreshToken';
const API_KEY = 'cove.apiUrl';
export const DEFAULT_NATIVE_API = 'https://imx-cbf0.onbelmo.uk';

function isLocalApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

function isNativePlatform(): boolean {
  try {
    const cap = (globalThis as { Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    } }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const platform = cap?.getPlatform?.();
    if (platform === 'android' || platform === 'ios') return true;
    // Bundled Capacitor WebViews use https://localhost (no port). Vite uses :5173.
    if (typeof window !== 'undefined') {
      const { hostname, port, protocol } = window.location;
      const localHost = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      if (localHost && !port && protocol === 'https:') return true;
      if (cap && localHost) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Make sure the Android/iOS app points at production IMX, not an old LAN address. */
export function ensureNativeApiUrl(): string {
  if (!isNativePlatform()) return getApiUrl();
  try {
    globalThis.localStorage?.setItem(API_KEY, DEFAULT_NATIVE_API);
  } catch {
    /* ignore */
  }
  return DEFAULT_NATIVE_API;
}

export function getApiUrl(): string {
  if (isNativePlatform()) {
    try {
      const stored = globalThis.localStorage?.getItem(API_KEY)?.replace(/\/$/, '') ?? '';
      if (stored && !isLocalApiUrl(stored)) return stored;
      globalThis.localStorage?.setItem(API_KEY, DEFAULT_NATIVE_API);
    } catch {
      /* ignore */
    }
    return DEFAULT_NATIVE_API;
  }
  try {
    const stored = globalThis.localStorage?.getItem(API_KEY);
    if (stored) {
      const cleaned = stored.replace(/\/$/, '');
      // Web: never call a private/LAN API — that hangs on "Opening IMX…"
      if (isLocalApiUrl(cleaned)) {
        try {
          globalThis.localStorage?.removeItem(API_KEY);
        } catch {
          /* ignore */
        }
      } else {
        return cleaned;
      }
    }
  } catch {
    /* ignore */
  }
  const fromEnv = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return '';
}

export function setApiUrl(url: string): void {
  localStorage.setItem(API_KEY, url.trim().replace(/\/$/, ''));
}

export const API_URL = getApiUrl();

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshInflight: Promise<string | null> | null = null;

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.error?.message ?? res.statusText);
  } catch {
    return new ApiError(res.status, res.statusText);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) return null;
      const res = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const body = await res.json();
      setTokens(body.tokens.accessToken, body.tokens.refreshToken);
      return body.tokens.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export { refreshAccessToken };

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (isNativePlatform()) ensureNativeApiUrl();
  const base = getApiUrl();
  if (!base && isNativePlatform()) {
    throw new ApiError(0, 'App is not connected to IMX. Reinstall the latest APK.');
  }

  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutMs = path.startsWith('/auth/') ? 12000 : 20000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  // Preserve caller signal if present
  const onAbort = () => controller.abort();
  init.signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'Server took too long. Check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach IMX. Check your internet and try again.');
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }

  if (res.status === 401 && retry && localStorage.getItem(REFRESH_KEY)) {
    const next = await refreshAccessToken();
    if (next) return request<T>(path, init, false);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register: (payload: { username: string; email: string; password: string; displayName: string }) =>
    request<{ user: PublicUser; tokens: { accessToken: string; refreshToken: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (identifier: string, password: string) =>
    request<{ user: PublicUser; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  health: () => request<{ status: string }>('/health/live'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: PublicUser }>('/auth/me'),
  updateMe: (payload: { displayName?: string; bio?: string; avatarUrl?: string | null }) =>
    request<{ user: PublicUser }>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  searchUsers: (q: string) => request<{ users: PublicUser[] }>(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id: string) => request<{ user: PublicUser }>(`/users/${id}`),
  conversations: () => request<{ conversations: Conversation[] }>('/conversations'),
  createConversation: (participantIds: string[], title?: string) =>
    request<{ conversationId: string }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantIds, title }),
    }),
  getConversation: (id: string) => request<{ conversation: Conversation & { members: Array<{ user: PublicUser }> } }>(`/conversations/${id}`),
  markRead: (id: string) => request<{ success: boolean }>(`/conversations/${id}/read`, { method: 'POST' }),
  messages: (conversationId: string, cursor?: string | null) => {
    const qs = new URLSearchParams({ limit: '40' });
    if (cursor) qs.set('cursor', cursor);
    return request<{ messages: ChatMessage[]; nextCursor: string | null; hasMore: boolean }>(
      `/conversations/${conversationId}/messages?${qs}`,
    );
  },
  sendMessage: (conversationId: string, body: string, clientMessageId: string, attachments?: Array<{ url: string; kind: string; fileName?: string }>, replyToId?: string | null) =>
    request<{ message: ChatMessage }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, clientMessageId, attachments, replyToId: replyToId ?? undefined }),
    }),
  editMessage: (conversationId: string, messageId: string, body: string) =>
    request<{ message: ChatMessage }>(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  deleteMessage: (conversationId: string, messageId: string) =>
    request<{ success: boolean }>(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' }),
  searchMessages: (conversationId: string, q: string) =>
    request<{ messages: ChatMessage[] }>(
      `/search/messages?q=${encodeURIComponent(q)}&conversationId=${conversationId}`,
    ),
  addReaction: (conversationId: string, messageId: string, emoji: string) =>
    request<{ reactions: Record<string, Array<{ id: string; userId: string; username: string; displayName: string }>> }>(
      `/conversations/${conversationId}/messages/${messageId}/reactions`,
      { method: 'POST', body: JSON.stringify({ emoji }) },
    ),
  removeReaction: (conversationId: string, messageId: string, emoji: string) =>
    request<{ reactions: Record<string, Array<{ id: string; userId: string; username: string; displayName: string }>> }>(
      `/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: 'DELETE' },
    ),
  updatePrefs: (id: string, prefs: { muted?: boolean; pinned?: boolean; theme?: string; backgroundUrl?: string | null }) =>
    request<{ prefs: { muted: boolean; pinned: boolean; theme: string; backgroundUrl: string | null } }>(`/conversations/${id}/prefs`, {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
  addMembers: (id: string, userIds: string[]) =>
    request<{ added: string[] }>(`/groups/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),
  leaveGroup: (id: string) => request<{ success: boolean }>(`/groups/${id}/leave`, { method: 'POST' }),
  removeMember: (id: string, userId: string) =>
    request<{ success: boolean }>(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),
  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string; fileName: string; mimeType: string; size: number }>('/uploads', { method: 'POST', body: form });
  },
  friends: () => request<{ friends: PublicUser[] }>('/friends'),
  friendRequests: () => request<{ received: Array<{ id: string; user: PublicUser; createdAt: string }>; sent: Array<{ id: string; user: PublicUser; createdAt: string }> }>('/friends/requests'),
  sendFriendRequest: (recipientId: string) => request<{ id: string; user: PublicUser; createdAt: string }>('/friends/request', { method: 'POST', body: JSON.stringify({ recipientId }) }),
  acceptFriendRequest: (requestId: string) => request<{ success: boolean }>(`/friends/accept/${requestId}`, { method: 'POST' }),
  rejectFriendRequest: (requestId: string) => request<{ success: boolean }>(`/friends/reject/${requestId}`, { method: 'POST' }),
  removeFriend: (friendId: string) => request<{ success: boolean }>(`/friends/${friendId}`, { method: 'DELETE' }),
  notifications: () => request<{ notifications: Array<{ id: string; type: string; title: string; body?: string; read: boolean; createdAt: string }> }>('/notifications'),
  unreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationsRead: () => request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),
  adminUsers: () =>
    request<{
      total: number;
      online: number;
      users: Array<{
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
      }>;
    }>('/admin/users'),
};

const SAFE_UPLOAD = /^\/uploads\/[A-Za-z0-9._-]+$/i;

export function toUploadPath(url: string): string {
  const index = url.indexOf('/uploads/');
  const path = (index === -1 ? url : url.slice(index)).split('?')[0].split('#')[0];
  return path;
}

export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:')) return url;
  const path = toUploadPath(url);
  if (!SAFE_UPLOAD.test(path)) return undefined;
  return `${getApiUrl()}${path}`;
}
