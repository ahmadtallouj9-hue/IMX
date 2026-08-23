import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, notFound } from '../utils/errors';
import { isAdminAccount } from '../utils/admin';
import { updateProfileSchema } from '../validation';
import { parseAvatarUrl } from '../utils/upload-security';

function publicMe(user: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    isAdmin: isAdminAccount(user),
  };
}

export class UsersController {
  static readonly routePrefix = '/users';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}/me`, { preValidation: [requireAuth] }, UsersController.getMe);
    app.patch(`${this.routePrefix}/me`, { preValidation: [requireAuth] }, UsersController.updateMe);
    app.get(`${this.routePrefix}/search`, { preValidation: [requireAuth] }, UsersController.search);
    app.post(`${this.routePrefix}/block/:userId`, { preValidation: [requireAuth] }, UsersController.block);
    app.delete(`${this.routePrefix}/block/:userId`, { preValidation: [requireAuth] }, UsersController.unblock);
    app.get(`${this.routePrefix}/blocked`, { preValidation: [requireAuth] }, UsersController.blockedList);
    app.get(`${this.routePrefix}/:id`, { preValidation: [requireAuth] }, UsersController.getById);
  }

  static async getMe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, email: true, displayName: true,
        bio: true, avatarUrl: true, isOnline: true, lastSeenAt: true, createdAt: true,
      },
    });
    if (!user) throw notFound('User not found');
    reply.send({ user: publicMe(user) });
  }

  static async updateMe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { displayName, bio, avatarUrl } = updateProfileSchema.parse(req.body ?? {});

    const data: Record<string, string | null> = {};
    if (displayName !== undefined) {
      if (displayName.trim().length < 1) throw badRequest('Display name cannot be empty');
      if (displayName.length > 50) throw badRequest('Display name must be 50 characters or less');
      data.displayName = displayName.trim();
    }
    if (bio !== undefined) {
      if (bio.length > 200) throw badRequest('Bio must be 200 characters or less');
      data.bio = bio.trim() || null;
    }
    if (avatarUrl !== undefined) {
      data.avatarUrl = parseAvatarUrl(avatarUrl) ?? null;
    }

    if (Object.keys(data).length === 0) {
      throw badRequest('No fields to update');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, username: true, email: true, displayName: true,
        bio: true, avatarUrl: true, isOnline: true, lastSeenAt: true, createdAt: true,
      },
    });

    reply.send({ user: publicMe(user) });
  }

  static async getById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!user) throw notFound('User not found');
    reply.send({ user });
  }

  static async search(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { q, limit: rawLimit } = req.query as { q?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(rawLimit ?? '20', 10) || 20, 1), 50);

    if (!q || q.trim().length < 2) {
      reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters' } });
      return;
    }

    const query = q.trim();

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { username: { contains: query } },
              { displayName: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
      },
      take: limit,
    });

    reply.send({ users });
  }

  static async block(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const blockerId = req.authUser!.id;
    const { userId } = req.params as { userId: string };

    if (blockerId === userId) {
      throw badRequest('Cannot block yourself');
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw notFound('User not found');

    try {
      await prisma.blockedUser.create({ data: { blockerId, blockedId: userId } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        reply.send({ success: true });
        return;
      }
      throw err;
    }

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: blockerId, userBId: userId },
          { userAId: userId, userBId: blockerId },
        ],
      },
    });

    await prisma.friendRequest.updateMany({
      where: {
        OR: [
          { senderId: blockerId, recipientId: userId, status: 'PENDING' },
          { senderId: userId, recipientId: blockerId, status: 'PENDING' },
        ],
      },
      data: { status: 'REJECTED' },
    });

    reply.send({ success: true });
  }

  static async unblock(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const blockerId = req.authUser!.id;
    const { userId } = req.params as { userId: string };

    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId: userId } });
    reply.send({ success: true });
  }

  static async blockedList(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    const blocked = await prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    reply.send({ blocked: blocked.map((b) => b.blocked) });
  }
}
