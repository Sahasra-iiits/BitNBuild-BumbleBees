// ==============================================================================
// SynapseLab — Auth Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { authLimiter } from '../../common/middleware/rate-limit';
import { env } from '../../config/env';

export const authRouter = Router();

// The strict limiter guards credential endpoints only. /refresh and /me run on every
// page load, and limiting them to 20 per 15 minutes logged active users out.

/**
 * POST /auth/register
 */
authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.register(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      // Set refresh token in HTTP-only cookie
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: env.COOKIE_HTTP_ONLY,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth',
      });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/guest - take part without an account (guest-enabled public experiments only).
 */
authRouter.post(
  '/guest',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.createGuest(req.ip, req.headers['user-agent']);
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: env.COOKIE_HTTP_ONLY,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });
      res.status(201).json({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/login
 */
authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AuthService.login(
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: env.COOKIE_HTTP_ONLY,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });

      res.json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/refresh
 */
authRouter.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.body.refreshToken || req.cookies?.refresh_token;
      const result = await AuthService.refreshToken(token);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth/logout
 */
authRouter.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.body.refreshToken || req.cookies?.refresh_token;
      const result = await AuthService.logout(token, req.user?.userId);

      res.clearCookie('refresh_token', { path: '/api/v1/auth' });
      res.clearCookie('access_token');

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /auth/me
 */
authRouter.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await AuthService.getCurrentUser(req.user!.userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

// Password reset and email verification need an email delivery service, which this
// deployment does not have. These endpoints previously reported success without doing
// anything; they now say so explicitly.
function notImplemented(feature: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: `${feature} is not available on this server.` } });
  };
}

authRouter.post('/forgot-password', authLimiter, notImplemented('Password reset'));
authRouter.post('/reset-password', authLimiter, notImplemented('Password reset'));
authRouter.post('/verify-email', authLimiter, notImplemented('Email verification'));
