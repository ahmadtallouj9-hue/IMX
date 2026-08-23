import { io, type Socket } from 'socket.io-client';
import { getAccessToken, getApiUrl, refreshAccessToken } from './api';

let socket: Socket | null = null;
let reconnectBound = false;
let lastRefreshAttempt = 0;
const REFRESH_COOLDOWN_MS = 15_000;

function bindAuthRefresh(sock: Socket): void {
  if (reconnectBound) return;
  reconnectBound = true;
  sock.io.on('reconnect_attempt', () => {
    sock.auth = { token: getAccessToken() };
  });
  sock.on('connect_error', () => {
    void (async () => {
      const now = Date.now();
      // Avoid a refresh storm when the server is simply down.
      if (now - lastRefreshAttempt < REFRESH_COOLDOWN_MS) return;
      lastRefreshAttempt = now;
      const next = await refreshAccessToken();
      if (!next || !socket) return;
      socket.auth = { token: next };
      if (!socket.connected) socket.connect();
    })();
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  const token = getAccessToken();
  if (socket?.connected) return socket;
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }
  socket = io(getApiUrl() || window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  bindAuthRefresh(socket);
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  reconnectBound = false;
  lastRefreshAttempt = 0;
}

export function joinConversation(conversationId: string): void {
  socket?.emit('conversation:join', { conversationId });
}
