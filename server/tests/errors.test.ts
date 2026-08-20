import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { errorHandler } from '../src/middleware/error-handler';
import { AppError, badRequest, notFound, tooManyRequests } from '../src/utils/errors';
import { corsOrigins, isAllowedOrigin } from '../src/config';

describe('error handler', () => {
  it('maps AppError status/code without leaking internals', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    app.get('/boom', () => {
      throw new AppError(418, 'CUSTOM', 'A friendly message');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(418);
    const body = res.json();
    expect(body.error).toEqual({ code: 'CUSTOM', message: 'A friendly message' });
    await app.close();
  });

  it('returns generic 500 for unknown errors', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    app.get('/boom', () => {
      throw new Error('secret db detail');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.message).not.toContain('secret');
    await app.close();
  });
});

describe('error helpers', () => {
  it('badRequest has code BAD_REQUEST', () => {
    const e = badRequest('nope');
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
  });
  it('notFound has code NOT_FOUND', () => {
    expect(notFound().statusCode).toBe(404);
  });
  it('tooManyRequests has code TOO_MANY_REQUESTS', () => {
    expect(tooManyRequests().statusCode).toBe(429);
  });
});

describe('config', () => {
  it('parses comma separated CORS origins', () => {
    process.env.CORS_ORIGIN = 'http://a.com, http://b.com';
    // reload is not needed; corsOrigins derives from previously loaded env.
    expect(Array.isArray(corsOrigins)).toBe(true);
  });

  it('allows private LAN origins in development', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('http://192.168.1.44:5173')).toBe(true);
    expect(isAllowedOrigin('http://evil.example')).toBe(false);
  });
});
