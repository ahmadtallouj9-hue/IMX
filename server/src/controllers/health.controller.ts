import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../database/prisma';
import { env } from '../config';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  services: {
    database: 'up' | 'down';
  };
  env: string;
}

/**
 * GET /health
 * Readiness probe that verifies the database connection.
 */
export async function healthCheck(
  _req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let database: 'up' | 'down' = 'up';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }

  const body: HealthStatus = {
    status: database === 'up' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: { database },
    env: env.NODE_ENV,
  };

  reply.status(database === 'up' ? 200 : 503).send(body);
}

/** GET /health/live — simple liveness probe, no dependencies. */
export async function liveCheck(
  _req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  reply.send({ status: 'ok', uptime: process.uptime() });
}
