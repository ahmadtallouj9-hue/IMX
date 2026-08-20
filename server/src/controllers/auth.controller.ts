import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../database/prisma';
import { PasswordService } from '../utils/password.service';
import { signAccessToken, signRefreshToken, rotateRefreshToken } from '../utils/jwt.service';
import { unauthorized } from '../utils/errors';
import { requireAuth } from '../middleware/auth';
import { randomBytes } from 'crypto';
import { registerSchema, loginSchema } from '../validation';
import { env } from '../config';

const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const authLimit = { config: { rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, timeWindow: env.RATE_LIMIT_WINDOW_MS } } };

export class AuthController {
  static readonly routePrefix = '/auth';

  static registerRoutes(app: FastifyInstance): void {
    app.post(`${this.routePrefix}/register`, authLimit, AuthController.register);
    app.post(`${this.routePrefix}/login`, authLimit, AuthController.login);
    app.get(`${this.routePrefix}/me`, { preValidation: [requireAuth] }, AuthController.me);
    app.post(`${this.routePrefix}/refresh`, authLimit, AuthController.refresh);
    app.post(`${this.routePrefix}/logout`, { preValidation: [requireAuth] }, AuthController.logout);
  }

  /** POST /auth/register — create a new user and issue tokens. */
  static async register(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { username, email, password, displayName } = registerSchema.parse(req.body);

    const pwValidation = PasswordService.validatePasswordLength(password);
    if (!pwValidation.valid) {
      reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: pwValidation.message } });
      return;
    }

    const passwordHash = await PasswordService.hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: { username, email, passwordHash, displayName: displayName ?? username },
      });

      const session = await AuthController.createSessionForUser(user.id, req);
      const tokens = AuthController.buildTokens(user, session);
      reply.status(201).send({ user: AuthController.publicUser(user), tokens });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        reply.status(409).send({ error: { code: 'DUPLICATE', message: 'Username or email already taken' } });
  } else {
        throw err;
  }
    }
  }

  static async login(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { identifier, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });

    const passwordMatch = await PasswordService.comparePassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatch) {
      reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      return;
    }

    const session = await AuthController.createSessionForUser(user.id, req);
    const tokens = AuthController.buildTokens(user, session);
    reply.send({ user: AuthController.publicUser(user), tokens });
  }

  /** GET /auth/me — return the authenticated user's profile. */
  static async me(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = (req as any).authUser?.id;
    if (!userId) {
      throw unauthorized('Missing or invalid authorization header');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, email: true, displayName: true,
        bio: true, avatarUrl: true, isOnline: true, createdAt: true,
      },
    });

    if (!user) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    reply.send({ user });
  }

    /** POST /auth/refresh — rotate refresh tokens and issue a new access token. */
  static async refresh(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { refreshToken } = req.body as { refreshToken: string };

    try {
      const { accessToken, newRefreshToken } = await rotateRefreshToken(refreshToken);
      reply.send({ tokens: { accessToken, refreshToken: newRefreshToken } });
    } catch (err) {
      const appErr = err as { statusCode?: number; code?: string; message?: string };
      reply.status(appErr.statusCode ?? 401).send({
        error: { code: appErr.code ?? 'UNAUTHORIZED', message: appErr.message ?? 'Invalid refresh token' },
      });
    }
  }

  /** POST /auth/logout — revoke active sessions for the authenticated user. */
  static async logout(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = (req as any).authUser?.id;

    if (userId) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    reply.send({ success: true });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static async createSessionForUser(
    userId: string,
    req: FastifyRequest,
  ): Promise<{ id: string; refreshToken: string; expiresAt: Date }> {
    const clientIp = req.ip ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    return prisma.session.create({
      data: {
        userId,
        refreshToken: randomBytes(32).toString('hex'),
        userAgent,
        ip: clientIp,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private static buildTokens(
    user: { id: string; username?: string | null },
    session: { refreshToken: string },
  ): { accessToken: string; refreshToken: string } {
    return {
      accessToken: signAccessToken(user.id, user.username ?? undefined),
      refreshToken: signRefreshToken(user.id, session.refreshToken),
    };
  }

  private static publicUser(
    user: { id: string; username: string | null; email: string; displayName: string | null; bio?: string | null; avatarUrl?: string | null; isOnline?: boolean; createdAt?: Date },
  ) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      isOnline: user.isOnline ?? false,
      createdAt: user.createdAt?.toISOString(),
    };
  }
}





