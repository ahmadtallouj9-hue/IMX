import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { AppError, unauthorized } from './errors';
import { prisma } from '../database/prisma';
import { env } from '../config';

/**
 * JWT payload interface.
 */
export interface JwtPayload {
  userId: string;
  username?: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT access token.
 */
export function signAccessToken(userId: string, username?: string): string {
  const payload: JwtPayload = { userId, username };
  // @ts-expect-error — jsonwebtoken overloads conflict with string-based expiresIn from env
  const token: string = sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
  return token;
}

/**
 * Sign a JWT refresh token.
 */
export function signRefreshToken(userId: string, refreshTokenId: string): string {
  const payload = { userId, refreshTokenId };
  // @ts-expect-error — jsonwebtoken overloads conflict with string-based expiresIn from env
  const token: string = sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
  return token;
}

/**
 * Verify a JWT access token and return the payload.
 * Throws AppError if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

/**
 * Verify a JWT refresh token and look up the corresponding session.
 * Returns the session if valid, throws otherwise.
 */
export async function verifyRefreshToken(
  token: string,
): Promise<{
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}> {
  try {
    const decoded = verify(token, env.JWT_REFRESH_SECRET) as { userId: string; refreshTokenId: string };
    const session = await prisma.session.findUnique({
      where: { refreshToken: decoded.refreshTokenId },
    });
    if (!session) {
      throw unauthorized('Invalid refresh token');
    }
    if (session.revokedAt !== null) {
      throw unauthorized('Refresh token has been revoked');
    }
    if (session.expiresAt < new Date()) {
      throw unauthorized('Refresh token has expired');
    }
    return session;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw unauthorized('Invalid refresh token');
  }
}

/**
 * Rotate refresh tokens.
 * - Invalidates the old refresh token (revokes the session)
 * - Creates a new session with a new refresh token
 * - Returns the new access token and new refresh token
 */
export async function rotateRefreshToken(oldToken: string): Promise<{
  accessToken: string;
  newRefreshToken: string;
  session: { id: string; userId: string };
}> {
  const session = await verifyRefreshToken(oldToken);

  // Revoke the old session
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  // Create a new session with a fresh refresh token
  const newRefreshTokenId = randomBytes(32).toString('hex');
  const newSession = await prisma.session.create({
    data: {
      userId: session.userId,
      refreshToken: newRefreshTokenId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const newAccessToken = signAccessToken(session.userId);
  const newRefreshToken = signRefreshToken(session.userId, newRefreshTokenId);

  return { accessToken: newAccessToken, newRefreshToken, session: { id: newSession.id, userId: newSession.userId } };
}
