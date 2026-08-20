import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { buildApp } from '../src/app';

const ts = Date.now();
const app = buildApp();
let port: number;
const base = () => `http://127.0.0.1:${port}`;

async function register(username: string, email: string, displayName: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { username, email, password: 'password123', displayName },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as {
    user: { id: string; username: string; displayName: string };
    tokens: { accessToken: string; refreshToken: string };
  };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(base(), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      timeout: 4000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err: Error) => reject(err));
  });
}

describe('auth + messaging + realtime', () => {
  let alice: Awaited<ReturnType<typeof register>>;
  let bob: Awaited<ReturnType<typeof register>>;
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers two users', async () => {
    alice = await register(`alice_${ts}`, `alice_${ts}@test.com`, 'Alice');
    bob = await register(`bob_${ts}`, `bob_${ts}@test.com`, 'Bob');
    expect(alice.user.id).not.toBe(bob.user.id);
  });

  it('rejects short passwords', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: `x_${ts}`, email: `x_${ts}@test.com`, password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in and returns the current user', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: alice.user.username, password: 'password123' },
    });
    expect(login.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: auth(login.json().tokens.accessToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe(alice.user.username);
  });

  it('rejects invalid login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: alice.user.username, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('protects conversation routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/conversations' });
    expect(res.statusCode).toBe(401);
  });

  it('searches users and returns profiles', async () => {
    const search = await app.inject({
      method: 'GET',
      url: `/users/search?q=bob_${ts}`,
      headers: auth(alice.tokens.accessToken),
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().users.some((u: { id: string }) => u.id === bob.user.id)).toBe(true);

    const profile = await app.inject({
      method: 'GET',
      url: `/users/${bob.user.id}`,
      headers: auth(alice.tokens.accessToken),
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().user.username).toBe(bob.user.username);
  });

  it('creates a direct conversation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: auth(alice.tokens.accessToken),
      payload: { participantIds: [bob.user.id] },
    });
    expect(res.statusCode).toBe(201);
    conversationId = res.json().conversationId;

    const again = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: auth(alice.tokens.accessToken),
      payload: { participantIds: [bob.user.id] },
    });
    expect(again.json().conversationId).toBe(conversationId);
  });

  it('sends a message and lists it', async () => {
    const send = await app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/messages`,
      headers: auth(alice.tokens.accessToken),
      payload: { body: 'hello bob' },
    });
    expect(send.statusCode).toBe(201);
    messageId = send.json().message.id;

    const list = await app.inject({
      method: 'GET',
      url: `/conversations/${conversationId}/messages`,
      headers: auth(bob.tokens.accessToken),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().messages[0].body).toBe('hello bob');
  });

  it('shows unread count then clears it on read', async () => {
    const unread = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: auth(bob.tokens.accessToken),
    });
    const conv = unread.json().conversations.find((c: { id: string }) => c.id === conversationId);
    expect(conv.unreadCount).toBeGreaterThan(0);

    const read = await app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/read`,
      headers: auth(bob.tokens.accessToken),
    });
    expect(read.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: auth(bob.tokens.accessToken),
    });
    const convAfter = after.json().conversations.find((c: { id: string }) => c.id === conversationId);
    expect(convAfter.unreadCount).toBe(0);
  });

  it('records read receipts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/messages/${messageId}/read`,
      headers: auth(bob.tokens.accessToken),
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/conversations/${conversationId}/messages`,
      headers: auth(alice.tokens.accessToken),
    });
    const msg = list.json().messages.find((m: { id: string }) => m.id === messageId);
    expect(msg.readBy.some((r: { userId: string }) => r.userId === bob.user.id)).toBe(true);
  });

  it('forbids non-members from messaging', async () => {
    const eve = await register(`eve_${ts}`, `eve_${ts}@test.com`, 'Eve');
    const res = await app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/messages`,
      headers: auth(eve.tokens.accessToken),
      payload: { body: 'nope' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates a group conversation', async () => {
    const eve = await register(`eve2_${ts}`, `eve2_${ts}@test.com`, 'Eve Two');
    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: auth(alice.tokens.accessToken),
      payload: { participantIds: [bob.user.id, eve.user.id], title: 'Trip planning' },
    });
    expect(res.statusCode).toBe(201);
    const group = await app.inject({
      method: 'GET',
      url: `/conversations/${res.json().conversationId}`,
      headers: auth(alice.tokens.accessToken),
    });
    expect(group.json().conversation.type).toBe('GROUP');
  });

  it('relays websocket messages, typing, presence, and reconnect', async () => {
    const a = await connectSocket(alice.tokens.accessToken);
    const b = await connectSocket(bob.tokens.accessToken);
    a.emit('conversation:join', { conversationId });
    b.emit('conversation:join', { conversationId });

    const gotMessage = new Promise<Record<string, unknown>>((resolve) => {
      b.once('message:new', resolve);
    });
    a.emit('message:send', { conversationId, body: 'realtime ping' });
    const incoming = await gotMessage;
    expect(incoming.body).toBe('realtime ping');

    const typing = new Promise<Record<string, unknown>>((resolve) => {
      b.once('typing:start', resolve);
    });
    a.emit('typing:start', { conversationId });
    const typingPayload = await typing;
    expect(typingPayload.userId).toBe(alice.user.id);

    const presence = new Promise<Record<string, unknown>>((resolve) => {
      b.once('presence:update', (p: { userId: string; isOnline: boolean }) => {
        if (p.userId === alice.user.id && p.isOnline === false) resolve(p);
      });
    });
    a.disconnect();
    const offline = await presence;
    expect(offline.isOnline).toBe(false);

    const a2 = await connectSocket(alice.tokens.accessToken);
    a2.emit('conversation:join', { conversationId });
    const gotAfterReconnect = new Promise<Record<string, unknown>>((resolve) => {
      b.once('message:new', resolve);
    });
    a2.emit('message:send', { conversationId, body: 'after reconnect' });
    const reconnected = await gotAfterReconnect;
    expect(reconnected.body).toBe('after reconnect');

    a2.disconnect();
    b.disconnect();
  });

  it('logs out and rejects the session refresh', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: auth(alice.tokens.accessToken),
    });
    expect(res.statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: alice.tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
  });
});
