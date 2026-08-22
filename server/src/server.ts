import { buildApp } from './app';
import { env } from './config';
import { logger } from './utils/logger';
import { disconnectDatabase, prisma } from './database/prisma';

async function autoMigrate(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "MessageReaction" (
        "id" TEXT NOT NULL,
        "messageId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "emoji" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
      )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji")`,
    `CREATE INDEX IF NOT EXISTS "MessageReaction_messageId_idx" ON "MessageReaction"("messageId")`,
    `CREATE INDEX IF NOT EXISTS "MessageReaction_userId_idx" ON "MessageReaction"("userId")`,
  ];
  try {
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }
    logger.info('Auto-migration: MessageReaction table ready');
  } catch (err) {
    logger.error({ err }, 'Auto-migration failed');
  }
}

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
    await autoMigrate();
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`IMX API listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.error(err);
    await disconnectDatabase();
    process.exit(1);
  }
}

void main();
