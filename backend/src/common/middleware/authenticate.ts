// ==============================================================================
// SynapseLab — Authentication Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, DecodedToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/app-error';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
      requestId?: string;
      correlationId?: string;
    }
  }
}

/**
 * Authenticate requests using Bearer token from Authorization header
 * or from HTTP-only cookie.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fallback to cookie
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired access token'));
    }
  }
}

/**
 * Optional authentication — sets req.user if token is present, but doesn't fail.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch {
    // Silently ignore — user is not authenticated
  }
  next();
}
