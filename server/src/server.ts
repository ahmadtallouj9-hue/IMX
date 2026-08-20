import { buildApp } from './app';
import { env } from './config';
import { logger } from './utils/logger';
import { disconnectDatabase } from './database/prisma';

async function main(): Promise<void> {
  const app = buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Chatter API listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.error(err);
    await disconnectDatabase();
    process.exit(1);
  }
}

void main();
