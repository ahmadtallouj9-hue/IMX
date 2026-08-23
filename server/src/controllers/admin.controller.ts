import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { forbidden, unauthorized } from '../utils/errors';
import { adminConfigured, isAdminAccount } from '../utils/admin';

export class AdminController {
  static readonly routePrefix = '/admin';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}/users`, { preValidation: [requireAuth] }, AdminController.listUsers);
  }

  static async requireAdmin(req: FastifyRequest): Promise<{ id: string; email: string; username: string }> {
    const userId = req.authUser?.id;
    if (!userId) throw unauthorized();

    if (!adminConfigured()) {
      throw forbidden('Admin access is not configured on this server');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    });
    if (!user || !isAdminAccount(user)) {
      throw forbidden('Admin access required');
    }
    return user;
  }

  /** GET /admin/users — all registered accounts (admin only). */
  static async listUsers(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await AdminController.requireAdmin(req);

    const now = new Date();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: now } },
          select: { id: true, createdAt: true, ip: true, userAgent: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    });

    reply.send({
      total: users.length,
      online: users.filter((u) => u.isOnline).length,
      users: users.map((u) => {
        const activeSessions = u.sessions;
        const latest = activeSessions[0] ?? null;
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          isOnline: u.isOnline,
          lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
          activeSessions: activeSessions.length,
          lastSignInAt: latest?.createdAt.toISOString() ?? null,
          lastSignInIp: latest?.ip ?? null,
          lastUserAgent: latest?.userAgent ?? null,
        };
      }),
    });
  }
}
