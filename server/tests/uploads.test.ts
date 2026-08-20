import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function multipart(fileName: string, mime: string, data: Buffer) {
  const boundary = '----coveboundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('avatar upload', () => {
  const app = buildApp();
  let token: string;

  beforeAll(async () => {
    await app.ready();
    const ts = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `pic_${ts}`,
        email: `pic_${ts}@test.com`,
        password: 'password123',
        displayName: 'Pic User',
      },
    });
    token = res.json().tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores an image and serves it as an image', async () => {
    const { payload, contentType } = multipart('dot.png', 'application/octet-stream', PNG);
    const upload = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload,
    });
    expect(upload.statusCode).toBe(201);
    const url = upload.json().url as string;
    expect(url).toContain('/uploads/');

    const path = url.slice(url.indexOf('/uploads/'));
    const saved = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarUrl: path },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().user.avatarUrl).toBe(path);

    const file = await app.inject({ method: 'GET', url: path });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects HTML disguised as an image', async () => {
    const { payload, contentType } = multipart(
      'hack.png',
      'image/png',
      Buffer.from('<script>alert(1)</script>'),
    );
    const upload = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload,
    });
    expect(upload.statusCode).toBe(400);
  });

  it('rejects unsafe avatar URLs', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { avatarUrl: 'javascript:alert(1)' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('mutes a conversation and stores a theme', async () => {
    const other = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: `pref_${Date.now()}`,
        email: `pref_${Date.now()}@test.com`,
        password: 'password123',
        displayName: 'Pref User',
      },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { authorization: `Bearer ${token}` },
      payload: { participantIds: [other.json().user.id], title: 'Prefs group' },
    });
    const id = created.json().conversationId as string;
    const prefs = await app.inject({
      method: 'PATCH',
      url: `/conversations/${id}/prefs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { muted: true, theme: 'ember' },
    });
    expect(prefs.statusCode).toBe(200);
    expect(prefs.json().prefs.muted).toBe(true);
    expect(prefs.json().prefs.theme).toBe('ember');
  });

  it('rejects path traversal on uploaded files', async () => {
    const res = await app.inject({ method: 'GET', url: '/uploads/..%2Fpackage.json' });
    expect([400, 404]).toContain(res.statusCode);
  });
});
