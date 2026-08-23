import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';

export class SearchController {
  static readonly routePrefix = '/search';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}/messages`, { preValidation: [requireAuth] }, SearchController.messages);
  }

  static async messages(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { q, conversationId, limit: rawLimit } = req.query as {
      q?: string;
      conversationId?: string;
      limit?: string;
    };
    const limit = Math.min(Math.max(parseInt(rawLimit ?? '20', 10) || 20, 1), 50);

    if (!q || q.trim().length < 2) {
      reply.send({ messages: [] });
      return;
    }

    const query = q.trim();

    // Get user's conversation IDs
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const convIds = memberships.map((m) => m.conversationId);

    if (convIds.length === 0) {
      reply.send({ messages: [] });
      return;
    }

    // Never search a conversation the caller is not a member of (IDOR).
    const scopedConversationId =
      conversationId && convIds.includes(conversationId) ? conversationId : null;
    if (conversationId && !scopedConversationId) {
      reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not a member of that conversation' } });
      return;
    }

    const where: any = {
      conversationId: scopedConversationId ? scopedConversationId : { in: convIds },
      deletedAt: null,
      body: { contains: query },
    };

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        conversation: { select: { id: true, type: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    reply.send({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        type: m.type,
        sender: m.sender,
        conversationId: m.conversationId,
        conversation: m.conversation,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }
}
