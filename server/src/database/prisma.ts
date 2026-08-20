import { PrismaClient } from '@prisma/client';

/**
 * Shared PrismaClient singleton for the entire application.
 * In dev/test, the query log is enabled to aid debugging.
 */
export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
});

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
