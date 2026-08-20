import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { requireAuth } from '../middleware/auth';
import { badRequest, notFound, forbidden } from '../utils/errors';
import { addMembersSchema } from '../validation';
import { addUsersToConversationRoom } from '../websocket/socket';

export class GroupsController {
  static readonly routePrefix = '/groups';

  static registerRoutes(app: FastifyInstance): void {
    app.post(`${this.routePrefix}/:conversationId/members`, { preValidation: [requireAuth] }, GroupsController.addMembers);
    app.delete(`${this.routePrefix}/:conversationId/members/:userId`, { preValidation: [requireAuth] }, GroupsController.removeMember);
    app.post(`${this.routePrefix}/:conversationId/leave`, { preValidation: [requireAuth] }, GroupsController.leave);
    app.patch(`${this.routePrefix}/:conversationId`, { preValidation: [requireAuth] }, GroupsController.updateGroup);
  }

  static async addMembers(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId } = req.params as { conversationId: string };
    const { userIds } = addMembersSchema.parse(req.body ?? {});

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw notFound('Conversation not found');
    if (conversation.type !== 'GROUP') throw badRequest('Can only add members to group conversations');

    const added: string[] = [];
    for (const uid of userIds) {
      const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
      if (!user) continue;

      const existing = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: uid } },
      });
      if (existing) continue;

      await prisma.conversationMember.create({
        data: { conversationId, userId: uid, role: 'MEMBER' },
      });
      added.push(uid);
    }

    addUsersToConversationRoom(conversationId, added);
    reply.send({ added });
  }

  static async removeMember(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId, userId: targetUserId } = req.params as { conversationId: string; userId: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw forbidden('Only owners and admins can remove members');
    }

    if (targetUserId === userId) throw badRequest('Cannot remove yourself');

    const targetMembership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });
    if (!targetMembership) throw notFound('Member not found');

    await prisma.conversationMember.delete({ where: { id: targetMembership.id } });
    reply.send({ success: true });
  }

  static async leave(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId } = req.params as { conversationId: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');

    if (membership.role === 'OWNER') {
      const otherMembers = await prisma.conversationMember.findMany({
        where: { conversationId, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
      });
      if (otherMembers.length === 0) {
        await prisma.conversation.delete({ where: { id: conversationId } });
      } else {
        await prisma.conversationMember.update({
          where: { id: otherMembers[0].id },
          data: { role: 'OWNER' },
        });
        await prisma.conversationMember.delete({ where: { id: membership.id } });
      }
    } else {
      await prisma.conversationMember.delete({ where: { id: membership.id } });
    }

    reply.send({ success: true });
  }

  static async updateGroup(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.authUser!.id;
    const { conversationId } = req.params as { conversationId: string };
    const { title, imageUrl } = req.body as { title?: string; imageUrl?: string };

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) throw forbidden('Not a member of this conversation');
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw forbidden('Only owners and admins can update the group');
    }

    const data: Record<string, string | null> = {};
    if (title !== undefined) data.title = title?.trim() || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;

    if (Object.keys(data).length === 0) {
      throw badRequest('No fields to update');
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data,
      select: { id: true, title: true, imageUrl: true },
    });

    reply.send({ conversation });
  }
}
