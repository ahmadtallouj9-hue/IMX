import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

describe('health endpoints', () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns ok with uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /health reports database service state', async () => {
    // Running without a live PostgreSQL this reports 'degraded' (503),
    // but the response shape is always consistent.
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect([200, 503]).toContain(res.statusCode);
    const body = res.json();
    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(body.services).toHaveProperty('database');
    expect(['up', 'down']).toContain(body.services.database);
    expect(typeof body.timestamp).toBe('string');
  });
});
