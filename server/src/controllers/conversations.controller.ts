import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, notFound, forbidden } from '../utils/errors';
import { chatPrefsSchema, createConversationSchema } from '../validation';
import { addUsersToConversationRoom } from '../websocket/socket';
import { parseAvatarUrl } from '../utils/upload-security';

export class ConversationsController {
  static readonly routePrefix = '/conversations';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}`, { preValidation: [requireAuth] }, ConversationsController.list);
    app.post(`${this.routePrefix}`, { preValidation: [requireAuth] }, ConversationsController.create);
    app.get(`${this.routePrefix}/:id`, { preValidation: [requireAuth] }, ConversationsController.get);
    app.post(`${this.routePrefix}/:id/read`, { preValidation: [requireAuth] }, ConversationsController.markRead);
    app.patch(`${this.routePrefix}/:id/prefs`, { preValidation: [requireAuth] }, ConversationsController.updatePrefs);
  }

  static async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true, muted: true, theme: true, backgroundUrl: true, role: true },
    });

    const convIds = memberships.map((m) => m.conversationId);
    if (convIds.length === 0) {
      reply.send({ conversations: [] });
      return;
    }

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: convIds } },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const membershipMap = new Map(memberships.map((m) => [m.conversationId, m]));

    const result = await Promise.all(conversations.map(async (c) => {
      const lastMsg = c.messages[0] ?? null;
      const otherMembers = c.members.filter((mem) => mem.userId !== userId);
      const mine = membershipMap.get(c.id);
      const lastReadAt = mine?.lastReadAt;

      let unreadCount = 0;
      if (lastMsg && !mine?.muted) {
        const whereClause: {
          conversationId: string;
          senderId: { not: string };
          createdAt?: { gt: Date };
        } = {
          conversationId: c.id,
          senderId: { not: userId },
        };
        if (lastReadAt) {
          whereClause.createdAt = { gt: lastReadAt };
        }
        unreadCount = await prisma.message.count({ where: whereClause });
      }

      return {
        id: c.id,
        type: c.type,
        title: c.title ?? (c.type === 'DIRECT' ? otherMembers[0]?.user.displayName : c.title),
        imageUrl: c.type === 'GROUP' ? c.imageUrl : otherMembers[0]?.user.avatarUrl,
        members: c.members.map((mem) => ({
          id: mem.user.id,
          username: mem.user.username,
          displayName: mem.user.displayName,
          avatarUrl: mem.user.avatarUrl,
          isOnline: mem.user.isOnline,
        })),
        lastMessage: lastMsg
          ? { body: lastMsg.body, senderName: lastMsg.sender.displayName, createdAt: lastMsg.createdAt.toISOString() }
          : null,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? c.createdAt.toISOString(),
        unreadCount,
        muted: mine?.muted ?? false,
        theme: mine?.theme ?? 'chatter',
        backgroundUrl: mine?.backgroundUrl ?? null,
        myRole: mine?.role ?? 'MEMBER',
      };
    }));

    reply.send({ conversations: result });
  }

  static async create(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { participantIds, title } = createConversationSchema.parse(req.body ?? {});
    const participants = [...new Set(participantIds.filter((id) => id !== userId))];
    if (participants.length > 0) {
      const found = await prisma.user.count({ where: { id: { in: participants } } });
      if (found !== participants.length) throw badRequest('One or more users were not found');
    }

    if (participants.length === 1 && !title) {
      const otherId = participants[0];
      const existingMemberships = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });

      for (const em of existingMemberships) {
        const conv = await prisma.conversation.findUnique({
          where: { id: em.conversationId },
          include: { members: true },
        });
        if (conv && conv.type === 'DIRECT') {
          const otherMember = conv.members.find((m) => m.userId === otherId);
          if (otherMember) {
            reply.send({ conversationId: conv.id });
            return;
          }
        }
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: participants.length > 1 || Boolean(title) ? 'GROUP' : 'DIRECT',
        title: title ?? null,
        createdBy: userId,
        members: {
          create: [
            { userId, role: 'OWNER' },
            ...participants.map((id) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      select: { id: true },
    });

    addUsersToConversationRoom(conversation.id, [userId, ...participants]);
    reply.status(201).send({ conversationId: conversation.id });
  }

  static async get(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true } } },
        },
      },
    });
    if (!conversation) throw notFound('Conversation not found');

    reply.send({ conversation });
  }

  static async markRead(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const now = new Date();
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: now },
    });

    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (lastMessage) {
      await prisma.messageRead.upsert({
        where: { messageId_userId: { messageId: lastMessage.id, userId } },
        update: { readAt: now },
        create: { messageId: lastMessage.id, userId, readAt: now },
      });
    }

    reply.send({ success: true });
  }

  static async updatePrefs(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };
    const body = chatPrefsSchema.parse(req.body ?? {});

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const data: { muted?: boolean; theme?: string; backgroundUrl?: string | null } = {};
    if (body.muted !== undefined) data.muted = body.muted;
    if (body.theme !== undefined) data.theme = body.theme;
    if (body.backgroundUrl !== undefined) data.backgroundUrl = parseAvatarUrl(body.backgroundUrl) ?? null;

    if (Object.keys(data).length === 0) throw badRequest('No fields to update');

    const updated = await prisma.conversationMember.update({
      where: { id: membership.id },
      data,
      select: { muted: true, theme: true, backgroundUrl: true },
    });

    reply.send({ prefs: updated });
  }
}
