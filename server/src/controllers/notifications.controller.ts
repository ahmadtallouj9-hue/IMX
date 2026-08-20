import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { notFound, badRequest } from '../utils/errors';

export class NotificationsController {
  static readonly routePrefix = '/notifications';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}`, { preValidation: [requireAuth] }, NotificationsController.list);
    app.post(`${this.routePrefix}/:id/read`, { preValidation: [requireAuth] }, NotificationsController.markRead);
    app.post(`${this.routePrefix}/read-all`, { preValidation: [requireAuth] }, NotificationsController.markAllRead);
    app.get(`${this.routePrefix}/unread-count`, { preValidation: [requireAuth] }, NotificationsController.unreadCount);
  }

  static async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { cursor, limit: rawLimit } = req.query as { cursor?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(rawLimit ?? '50', 10) || 50, 1), 100);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(cursor ? { createdAt: { lt: new Date(Buffer.from(cursor, 'base64').toString()) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore
      ? Buffer.from(items[items.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    reply.send({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data ? JSON.parse(n.data as string) : null,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    });
  }

  static async markRead(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw notFound('Notification not found');
    if (notification.userId !== userId) throw badRequest('Not your notification');

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    reply.send({ success: true });
  }

  static async markAllRead(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    reply.send({ success: true });
  }

  static async unreadCount(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    const count = await prisma.notification.count({
      where: { userId, read: false },
    });

    reply.send({ count });
  }
}
