// ==============================================================================
// SynapseLab — Global Error Handler
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';

/**
 * Global error handler middleware.
 * Returns consistent JSON error responses. Never leaks internal details.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || req.headers['x-request-id'] || 'unknown';

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId, method: req.method, path: req.path }, 'Non-operational error');
    } else {
      logger.warn({ code: err.code, message: err.message, requestId, method: req.method, path: req.path }, 'Application error');
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
        message: tooLarge ? 'The file is too large.' : `Upload rejected: ${err.message}`,
        requestId,
      },
    });
    return;
  }

  // body-parser errors (malformed JSON, body too large) carry an HTTP status.
  const httpErr = err as Error & { status?: number; type?: string };
  if (httpErr.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body', requestId } });
    return;
  }
  if (httpErr.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large', requestId } });
    return;
  }

  logger.error({ err, requestId, method: req.method, path: req.path }, 'Unhandled error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
