import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, notFound, conflict } from '../utils/errors';

export class FriendsController {
  static readonly routePrefix = '/friends';

  static registerRoutes(app: FastifyInstance): void {
    app.get(`${this.routePrefix}`, { preValidation: [requireAuth] }, FriendsController.list);
    app.get(`${this.routePrefix}/requests`, { preValidation: [requireAuth] }, FriendsController.requests);
    app.post(`${this.routePrefix}/request`, { preValidation: [requireAuth] }, FriendsController.sendRequest);
    app.post(`${this.routePrefix}/accept/:requestId`, { preValidation: [requireAuth] }, FriendsController.accept);
    app.post(`${this.routePrefix}/reject/:requestId`, { preValidation: [requireAuth] }, FriendsController.reject);
    app.delete(`${this.routePrefix}/:friendId`, { preValidation: [requireAuth] }, FriendsController.remove);
  }

  static async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true } },
        userB: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true } },
      },
    });

    const friends = friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
    reply.send({ friends });
  }

  static async requests(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;

    const [received, sent] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { recipientId: userId, status: 'PENDING' },
        include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: { recipient: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    reply.send({
      received: received.map((r) => ({ id: r.id, user: r.sender, createdAt: r.createdAt })),
      sent: sent.map((r) => ({ id: r.id, user: r.recipient, createdAt: r.createdAt })),
    });
  }

  static async sendRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const senderId = req.authUser!.id;
    const { recipientId } = req.body as { recipientId: string };

    if (!recipientId) throw badRequest('recipientId is required');
    if (senderId === recipientId) throw badRequest('Cannot send friend request to yourself');

    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient) throw notFound('User not found');

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: senderId, userBId: recipientId },
          { userAId: recipientId, userBId: senderId },
        ],
      },
    });
    if (existingFriendship) {
      throw conflict('Already friends');
    }

    // Check if blocked
    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: senderId },
          { blockerId: senderId, blockedId: recipientId },
        ],
      },
    });
    if (blocked) {
      throw badRequest('Cannot send friend request to this user');
    }

    // Check for existing request (either direction)
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, recipientId, status: 'PENDING' },
          { senderId: recipientId, recipientId: senderId, status: 'PENDING' },
        ],
      },
    });
    if (existingRequest) {
      throw conflict('Friend request already pending');
    }

    const request = await prisma.friendRequest.create({
      data: { senderId, recipientId },
      include: { recipient: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'FRIEND_REQUEST',
        title: 'New friend request',
        body: `You have a new friend request`,
        data: JSON.stringify({ requestId: request.id, senderId }),
      },
    });

    reply.status(201).send({
      id: request.id,
      user: request.recipient,
      createdAt: request.createdAt,
    });
  }

  static async accept(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { requestId } = req.params as { requestId: string };

    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw notFound('Friend request not found');
    if (request.recipientId !== userId) throw badRequest('Not your friend request');
    if (request.status !== 'PENDING') throw badRequest('Request already handled');

    // Create friendship (ensure consistent ordering)
    const [userAId, userBId] = [request.senderId, request.recipientId].sort();

    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
      prisma.friendship.create({ data: { userAId, userBId } }),
      prisma.notification.create({
        data: {
          userId: request.senderId,
          type: 'FRIEND_ACCEPTED',
          title: 'Friend request accepted',
          body: `Your friend request was accepted`,
          data: JSON.stringify({ requestId, acceptedBy: userId }),
        },
      }),
    ]);

    reply.send({ success: true });
  }

  static async reject(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { requestId } = req.params as { requestId: string };

    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw notFound('Friend request not found');
    if (request.recipientId !== userId) throw badRequest('Not your friend request');
    if (request.status !== 'PENDING') throw badRequest('Request already handled');

    await prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
    reply.send({ success: true });
  }

  static async remove(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { friendId } = req.params as { friendId: string };

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userAId: userId, userBId: friendId },
          { userAId: friendId, userBId: userId },
        ],
      },
    });

    reply.send({ success: true });
  }
}
