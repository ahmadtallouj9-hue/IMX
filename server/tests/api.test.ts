import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';

let app: ReturnType<typeof buildApp>;
const ts = Date.now();

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Notifications API', () => {
  let accessToken: string;

  it('should register a user for testing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `notif_test_${ts}`,
        email: `notif_${ts}@test.com`,
        password: 'password123',
        displayName: 'Notification Test',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    accessToken = body.tokens.accessToken;
  });

  it('should list notifications (empty)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toBeDefined();
    expect(Array.isArray(body.notifications)).toBe(true);
  });

  it('should return unread count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.count).toBe('number');
  });

  it('should mark all as read', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Groups API', () => {
  let accessToken: string;
  let conversationId: string;
  let secondUserId: string;

  it('should register a user for testing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `group_test_${ts}`,
        email: `group_${ts}@test.com`,
        password: 'password123',
        displayName: 'Group Test',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    accessToken = body.tokens.accessToken;
  });

  it('should register a second user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `group_member_${ts}`,
        email: `group_member_${ts}@test.com`,
        password: 'password123',
        displayName: 'Group Member',
      },
    });
    expect(res.statusCode).toBe(201);
    secondUserId = res.json().user.id;
  });

  it('should create a group conversation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        participantIds: [secondUserId],
        title: 'Test Group',
      },
    });
    expect(res.statusCode).toBe(201);
    conversationId = res.json().conversationId;
  });

  it('should update group title', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/groups/${conversationId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'Updated Group Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().conversation.title).toBe('Updated Group Name');
  });

  it('should leave group', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/groups/${conversationId}/leave`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

describe('Message Edit/Delete', () => {
  let accessToken: string;
  let conversationId: string;
  let messageId: string;

  it('should register and create conversation', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `msg_test_${ts}`,
        email: `msg_${ts}@test.com`,
        password: 'password123',
        displayName: 'Message Test',
      },
    });
    expect(regRes.statusCode).toBe(201);
    accessToken = regRes.json().tokens.accessToken;

    const convRes = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { participantIds: [] },
    });
    expect(convRes.statusCode).toBe(201);
    conversationId = convRes.json().conversationId;
  });

  it('should send a message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { body: 'Hello world' },
    });
    expect(res.statusCode).toBe(201);
    messageId = res.json().message.id;
  });

  it('should edit a message', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/conversations/${conversationId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { body: 'Hello edited' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message.body).toBe('Hello edited');
  });

  it('should delete a message', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/conversations/${conversationId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('should not allow editing others messages', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `msg_test2_${ts}`,
        email: `msg2_${ts}@test.com`,
        password: 'password123',
        displayName: 'Message Test 2',
      },
    });
    const otherToken = regRes.json().tokens.accessToken;

    const res = await app.inject({
      method: 'PATCH',
      url: `/conversations/${conversationId}/messages/${messageId}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { body: 'Hacked!' },
    });
    expect(res.statusCode).toBe(403);
  });
});
