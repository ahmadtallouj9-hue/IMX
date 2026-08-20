import type { FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../utils/jwt.service';
import { unauthorized } from '../utils/errors';

export interface AuthUser {
  id: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/**
 * Authentication guard.
 *
 * Parses the Bearer token, verifies the JWT, and populates request.authUser.
 * Throws AppError (401) if the token is missing, invalid, or expired.
 */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Missing or invalid authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw unauthorized('Missing access token');
  }

  const payload = verifyAccessToken(token);
  request.authUser = { id: payload.userId };
}

export { unauthorized };

