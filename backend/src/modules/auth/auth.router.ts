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

// Apply stricter rate limiting to all auth endpoints
authRouter.use(authLimiter);

/**
 * POST /auth/register
 */
authRouter.post(
  '/register',
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
 * POST /auth/login
 */
authRouter.post(
  '/login',
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

/**
 * POST /auth/forgot-password
 */
authRouter.post( /forgot-password, validate({ body: z.object({ email: z.string().email() }) }), async (req: Request, res: Response) = res.json({ message: If the email exists a password reset link has been sent. }); });

/**
 * POST /auth/reset-password
 */
authRouter.post(/reset-password, validate({ body: z.object({ token: z.string(), newPassword: z.string().min(8) }) }), async (req: Request, res: Response) = res.json({ message: Password has been successfully reset. }); });

/**
 * POST /auth/verify-email
 */
authRouter.post(/verify-email, validate({ body: z.object({ token: z.string() }) }), async (req: Request, res: Response) = res.json({ message: Email has been successfully verified. }); });
