import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, forbidden } from '../utils/errors';

const jwkSchema = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string().min(1).max(128),
  y: z.string().min(1).max(128),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional(),
});

const putKeySchema = z.object({
  publicJwk: jwkSchema,
});

const putSharesSchema = z.object({
  shares: z
    .array(
      z.object({
        userId: z.string().min(1).max(64),
        wrappedKey: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(100),
});

export class KeysController {
  static registerRoutes(app: FastifyInstance): void {
    app.put('/users/me/crypto-key', { preValidation: [requireAuth] }, KeysController.putMyKey);
    app.get('/users/me/crypto-key', { preValidation: [requireAuth] }, KeysController.getMyKey);
    app.get('/users/:id/crypto-key', { preValidation: [requireAuth] }, KeysController.getUserKey);
    app.post('/users/crypto-keys', { preValidation: [requireAuth] }, KeysController.getManyKeys);
    app.get('/conversations/:id/e2e-key', { preValidation: [requireAuth] }, KeysController.getConvKey);
    app.put('/conversations/:id/e2e-keys', { preValidation: [requireAuth] }, KeysController.putConvKeys);
  }

  static async putMyKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { publicJwk } = putKeySchema.parse(req.body ?? {});
    const publicJwkStr = JSON.stringify(publicJwk);
    const row = await prisma.userCryptoKey.upsert({
      where: { userId },
      create: { userId, publicJwk: publicJwkStr },
      update: { publicJwk: publicJwkStr },
    });
    reply.send({
      publicJwk: JSON.parse(row.publicJwk),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  static async getMyKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const row = await prisma.userCryptoKey.findUnique({ where: { userId } });
    if (!row) {
      reply.send({ publicJwk: null });
      return;
    }
    reply.send({ publicJwk: JSON.parse(row.publicJwk), updatedAt: row.updatedAt.toISOString() });
  }

  static async getUserKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const row = await prisma.userCryptoKey.findUnique({ where: { userId: id } });
    if (!row) {
      reply.send({ userId: id, publicJwk: null });
      return;
    }
    reply.send({ userId: id, publicJwk: JSON.parse(row.publicJwk), updatedAt: row.updatedAt.toISOString() });
  }

  static async getManyKeys(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = z.object({ userIds: z.array(z.string().min(1).max(64)).min(1).max(100) }).parse(req.body ?? {});
    const rows = await prisma.userCryptoKey.findMany({
      where: { userId: { in: body.userIds } },
    });
    const byId = new Map(rows.map((r) => [r.userId, r]));
    reply.send({
      keys: body.userIds.map((userId) => {
        const row = byId.get(userId);
        return {
          userId,
          publicJwk: row ? JSON.parse(row.publicJwk) : null,
        };
      }),
    });
  }

  static async getConvKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id: conversationId } = req.params as { id: string };
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const share = await prisma.conversationKeyShare.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    const shareCount = await prisma.conversationKeyShare.count({ where: { conversationId } });
    reply.send({ wrappedKey: share?.wrappedKey ?? null, hasShares: shareCount > 0 });
  }

  static async putConvKeys(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id: conversationId } = req.params as { id: string };
    const { shares } = putSharesSchema.parse(req.body ?? {});

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const memberIds = new Set(
      (
        await prisma.conversationMember.findMany({
          where: { conversationId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );

    for (const share of shares) {
      if (!memberIds.has(share.userId)) {
        throw badRequest(`User ${share.userId} is not a member of this conversation`);
      }
    }

    await prisma.$transaction(
      shares.map((share) =>
        prisma.conversationKeyShare.upsert({
          where: { conversationId_userId: { conversationId, userId: share.userId } },
          create: {
            conversationId,
            userId: share.userId,
            wrappedKey: share.wrappedKey,
          },
          update: { wrappedKey: share.wrappedKey },
        }),
      ),
    );

    reply.send({ success: true, count: shares.length });
  }
}
