// ==============================================================================
// SynapseLab — Global Error Handler
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
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
    // Operational errors — expected, safe to expose
    if (!err.isOperational) {
      logger.error(
        { err, requestId, method: req.method, path: req.path },
        'Non-operational error'
      );
    } else {
      logger.warn(
        { code: err.code, message: err.message, requestId, method: req.method, path: req.path },
        'Application error'
      );
    }

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
    return;
  }

  // Unexpected errors — log full details, return generic message
  logger.error(
    { err, requestId, method: req.method, path: req.path },
    'Unhandled error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
