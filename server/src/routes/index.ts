import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { AuthController } from '../controllers/auth.controller';
import { UsersController } from '../controllers/users.controller';
import { FriendsController } from '../controllers/friends.controller';
import { ConversationsController } from '../controllers/conversations.controller';
import { MessagesController } from '../controllers/messages.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { GroupsController } from '../controllers/groups.controller';
import { SearchController } from '../controllers/search.controller';
import { UploadsController } from '../controllers/uploads.controller';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.register(healthRoutes);
  AuthController.registerRoutes(app);
  UsersController.registerRoutes(app);
  FriendsController.registerRoutes(app);
  ConversationsController.registerRoutes(app);
  MessagesController.registerRoutes(app);
  NotificationsController.registerRoutes(app);
  GroupsController.registerRoutes(app);
  SearchController.registerRoutes(app);
  UploadsController.registerRoutes(app);
}
