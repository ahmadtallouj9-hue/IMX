import type { FastifyInstance } from 'fastify';
import { healthCheck, liveCheck } from '../controllers/health.controller';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', healthCheck);
  app.get('/health/live', liveCheck);
}
