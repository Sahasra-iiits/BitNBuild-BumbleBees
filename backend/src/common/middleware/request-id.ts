// ==============================================================================
// SynapseLab — Request ID / Correlation ID Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Assigns a unique request ID and correlation ID to every request.
 * The request ID is returned in the X-Request-Id response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const correlationId = (req.headers['x-correlation-id'] as string) || requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}
