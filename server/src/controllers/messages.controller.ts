import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { sendMessageSchema } from '../validation';

export class MessagesController {
  static readonly routePrefix = '/conversations/:conversationId/messages';

  static registerRoutes(app: FastifyInstance): void {
    app.get(this.routePrefix, { preValidation: [requireAuth] }, MessagesController.list);
    app.post(this.routePrefix, { preValidation: [requireAuth] }, MessagesController.send);
    app.patch(`${this.routePrefix}/:messageId`, { preValidation: [requireAuth] }, MessagesController.edit);
    app.delete(`${this.routePrefix}/:messageId`, { preValidation: [requireAuth] }, MessagesController.delete);
    app.post(`${this.routePrefix}/:messageId/read`, { preValidation: [requireAuth] }, MessagesController.markRead);
  }

  static async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId } = req.params as { conversationId: string };
    const { cursor, limit: rawLimit } = req.query as { cursor?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(rawLimit ?? '50', 10) || 50, 1), 100);

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(Buffer.from(cursor, 'base64').toString()) } } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        readBy: { select: { userId: true, readAt: true } },
        attachments: { select: { id: true, kind: true, url: true, mimeType: true, size: true, fileName: true, width: true, height: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? Buffer.from(items[items.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    reply.send({
      messages: items.map((m) => ({
        id: m.id,
        clientMessageId: m.clientMessageId,
        body: m.body,
        type: m.type,
        status: m.status,
        sender: m.sender,
        replyToId: m.replyToId,
        conversationId,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        readBy: m.readBy.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })),
        attachments: m.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          url: a.url,
          mimeType: a.mimeType,
          size: a.size,
          fileName: a.fileName,
          width: a.width,
          height: a.height,
        })),
      })),
      nextCursor,
      hasMore,
    });
  }

  static async send(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId } = req.params as { conversationId: string };
    const parsed = sendMessageSchema.parse(req.body ?? {});
    const { body, clientMessageId, replyToId } = parsed;
    const attachments = (req.body as { attachments?: Array<{ url: string; kind: string; mimeType?: string; size?: number; fileName?: string; width?: number; height?: number }> })?.attachments;

    if ((!body || body.trim().length === 0) && (!attachments || attachments.length === 0)) {
      throw badRequest('Message body or attachments are required');
    }

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    if (clientMessageId) {
      const existing = await prisma.message.findUnique({
        where: { clientMessageId },
        include: {
          sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          attachments: { select: { id: true, kind: true, url: true, mimeType: true, size: true, fileName: true, width: true, height: true } },
          readBy: { select: { userId: true, readAt: true } },
        },
      });
      if (existing) {
        reply.send({
          message: {
            id: existing.id,
            clientMessageId: existing.clientMessageId,
            body: existing.body,
            type: existing.type,
            status: existing.status,
            sender: existing.sender,
            replyToId: existing.replyToId,
            conversationId,
            createdAt: existing.createdAt.toISOString(),
            updatedAt: existing.updatedAt.toISOString(),
            readBy: existing.readBy.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })),
            attachments: existing.attachments,
          },
        });
        return;
      }
    }

    const hasAttachments = attachments && attachments.length > 0;
    const messageType = hasAttachments ? (attachments![0].kind === 'image' ? 'IMAGE' : 'FILE') : 'TEXT';

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body: body?.trim() || null,
        type: messageType,
        clientMessageId: clientMessageId ?? null,
        replyToId: replyToId ?? null,
        ...(hasAttachments ? {
          attachments: {
            create: attachments!.map((a) => ({
              url: a.url,
              kind: a.kind,
              mimeType: a.mimeType ?? null,
              size: a.size ?? null,
              fileName: a.fileName ?? null,
              width: a.width ?? null,
              height: a.height ?? null,
            })),
          },
        } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        attachments: { select: { id: true, kind: true, url: true, mimeType: true, size: true, fileName: true, width: true, height: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const payload = {
      id: message.id,
      clientMessageId: message.clientMessageId,
      body: message.body,
      type: message.type,
      status: message.status,
      sender: message.sender,
      replyToId: message.replyToId,
      conversationId,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      readBy: [] as Array<{ userId: string; readAt: string }>,
      attachments: message.attachments,
    };

    try {
      const { getIO } = await import('../websocket/socket');
      getIO()?.to(`conversation:${conversationId}`).emit('message:new', payload);
    } catch {
      // Socket server may not be listening in isolated HTTP tests.
    }

    reply.status(201).send({ message: payload });
  }

  static async edit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId, messageId } = req.params as { conversationId: string; messageId: string };
    const { body } = req.body as { body?: string };

    if (!body || body.trim().length === 0) {
      throw badRequest('Message body is required');
    }

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw notFound('Message not found');
    if (message.conversationId !== conversationId) throw notFound('Message not found in this conversation');
    if (message.senderId !== userId) throw forbidden('You can only edit your own messages');
    if (message.deletedAt) throw badRequest('Cannot edit a deleted message');

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { body: body.trim(), updatedAt: new Date() },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    const { getIO } = await import('../websocket/socket');
    getIO().to(`conversation:${conversationId}`).emit('message:edited', {
      id: updated.id,
      body: updated.body,
      conversationId,
      editedAt: updated.updatedAt.toISOString(),
    });

    reply.send({
      message: {
        id: updated.id,
        body: updated.body,
        type: updated.type,
        sender: updated.sender,
        replyToId: updated.replyToId,
        conversationId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }

  static async delete(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId, messageId } = req.params as { conversationId: string; messageId: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw notFound('Message not found');
    if (message.conversationId !== conversationId) throw notFound('Message not found in this conversation');
    if (message.senderId !== userId) throw forbidden('You can only delete your own messages');
    if (message.deletedAt) throw badRequest('Message already deleted');

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null },
    });

    const { getIO } = await import('../websocket/socket');
    getIO().to(`conversation:${conversationId}`).emit('message:deleted', {
      id: messageId,
      conversationId,
    });

    reply.send({ success: true });
  }

  static async markRead(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId, messageId } = req.params as { conversationId: string; messageId: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { readAt: new Date() },
      create: { messageId, userId },
    });

    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    });

    reply.send({ success: true });
  }
}
