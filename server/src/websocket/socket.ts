import type { FastifyInstance } from 'fastify';
import type { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.service';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

let io: SocketIOServer;

// Map userId -> Set of socket ids (user can have multiple devices)
const onlineUsers = new Map<string, Set<string>>();

export function getIO(): SocketIOServer {
  return io;
}

export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return sockets != null && sockets.size > 0;
}

export function addUsersToConversationRoom(conversationId: string, userIds: string[]): void {
  if (!io) return;
  for (const uid of userIds) {
    const sockets = onlineUsers.get(uid);
    if (!sockets) continue;
    for (const sid of sockets) {
      io.sockets.sockets.get(sid)?.join(`conversation:${conversationId}`);
    }
  }
}

function emitPresence(userId: string, isOnline: boolean): void {
  if (!io) return;
  io.emit('presence:update', {
    userId,
    isOnline,
    lastSeenAt: isOnline ? null : new Date().toISOString(),
  });
}

export function setupSocketIO(app: FastifyInstance): void {
  io = new SocketIOServer(app.server as unknown as Server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});
    emitPresence(userId, true);
    socket.emit('presence:snapshot', { userIds: [...onlineUsers.keys()] });

    joinUserRooms(socket, userId);

    socket.on('conversation:join', async (data: { conversationId?: string }) => {
      if (!data?.conversationId) return;
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } },
      });
      if (membership) socket.join(`conversation:${data.conversationId}`);
    });

    // --- Events ---

    socket.on('message:send', async (data: { conversationId: string; body?: string; clientMessageId?: string; attachments?: Array<{ url: string; kind: string; mimeType?: string; size?: number; fileName?: string }> }) => {
      try {
        const { conversationId, body, clientMessageId } = data;
        const rawAttachments = Array.isArray(data.attachments) ? data.attachments.slice(0, 8) : [];
        const attachments = rawAttachments
          .map((a) => {
            const path = typeof a.url === 'string' && a.url.includes('/uploads/')
              ? a.url.slice(a.url.indexOf('/uploads/')).split('?')[0].split('#')[0]
              : '';
            if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(path)) return null;
            return {
              url: path,
              kind: String(a.kind ?? 'file').slice(0, 20),
              mimeType: a.mimeType,
              size: a.size,
              fileName: a.fileName,
            };
          })
          .filter((a): a is NonNullable<typeof a> => a != null);

        const trimmed = body?.trim() ?? '';
        if ((!trimmed && attachments.length === 0) || trimmed.length > 4000) return;

        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!membership) return;

        const hasAttachments = attachments.length > 0;
        const kind = hasAttachments ? attachments[0].kind : null;
        const messageType = hasAttachments
          ? kind === 'image' ? 'IMAGE' : kind === 'video' ? 'VIDEO' : kind === 'audio' ? 'AUDIO' : 'FILE'
          : 'TEXT';

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            body: trimmed || null,
            type: messageType,
            clientMessageId: clientMessageId ?? null,
            ...(hasAttachments ? {
              attachments: {
                create: attachments.map((a) => ({
                  url: a.url,
                  kind: a.kind,
                  mimeType: a.mimeType ?? null,
                  size: a.size ?? null,
                  fileName: a.fileName ?? null,
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

        const otherMembers = await prisma.conversationMember.findMany({
          where: { conversationId, userId: { not: userId } },
          select: { userId: true },
        });
        const delivered = otherMembers.some((m) => isUserOnline(m.userId));
        if (delivered) {
          await prisma.message.update({ where: { id: message.id }, data: { status: 'DELIVERED' } });
        }

        const payload = {
          id: message.id,
          clientMessageId: message.clientMessageId,
          body: message.body,
          type: message.type,
          status: delivered ? 'DELIVERED' : 'SENT',
          sender: message.sender,
          replyToId: message.replyToId,
          conversationId: conversationId,
          createdAt: message.createdAt.toISOString(),
          readBy: [],
          attachments: message.attachments,
        };

        io.to(`conversation:${conversationId}`).emit('message:new', payload);
      } catch (err) {
        logger.error(err, 'message:send error');
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing:start', async (data: { conversationId: string }) => {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } },
      });
      if (!membership) return;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true },
      });

      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId,
        displayName: user?.displayName,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing:stop', async (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } },
      });
      if (!membership) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('message:read', async (data: { conversationId: string; messageId: string }) => {
      try {
        if (!data?.conversationId || !data?.messageId) return;
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: data.conversationId, userId } },
        });
        if (!membership) return;

        const message = await prisma.message.findFirst({
          where: { id: data.messageId, conversationId: data.conversationId },
          select: { id: true },
        });
        if (!message) return;

        await prisma.messageRead.upsert({
          where: { messageId_userId: { messageId: data.messageId, userId } },
          update: { readAt: new Date() },
          create: { messageId: data.messageId, userId },
        });

        await prisma.conversationMember.updateMany({
          where: { conversationId: data.conversationId, userId },
          data: { lastReadAt: new Date() },
        });

        await prisma.message.updateMany({
          where: { id: data.messageId, senderId: { not: userId } },
          data: { status: 'READ' },
        });

        socket.to(`conversation:${data.conversationId}`).emit('message:read', {
          userId,
          messageId: data.messageId,
          conversationId: data.conversationId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error(err, 'message:read error');
      }
    });

    socket.on('disconnect', async () => {
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeenAt: new Date() },
          }).catch(() => {});
          emitPresence(userId, false);
        }
      }
    });
  });
}

async function joinUserRooms(socket: any, userId: string): Promise<void> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  for (const m of memberships) {
    socket.join(`conversation:${m.conversationId}`);
  }
}
