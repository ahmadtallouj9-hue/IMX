import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Global Fastify error handler.
 * - AppError: returns its status/code/message (never leaks internals).
 * - ZodError (validation): returns 400 with structured field errors.
 * - Prisma known errors: mapped to user-friendly 4xx responses.
 * - Anything else: logged and returned as a generic 500.
 */
export function errorHandler(
  error: Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.flatten().fieldErrors,
      },
    });
    return;
  }

  // Prisma unique constraint violations
  const prismaErr = error as { code?: string };
  if (prismaErr.code === 'P2002') {
    reply.status(409).send({
      error: { code: 'DUPLICATE', message: 'A record with that value already exists' },
    });
    return;
  }
  if (prismaErr.code === 'P2025') {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Requested record was not found' },
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');
  reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
