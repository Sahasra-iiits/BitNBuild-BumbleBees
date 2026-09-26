// ==============================================================================
// SynapseLab — Users Router (Admin)
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireAdmin } from '../../common/middleware/authorize';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import { NotFoundError } from '../../common/errors/app-error';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../../config/constants';

export const usersRouter = Router();

const userIdParam = z.object({ id: z.string().uuid() });
const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: z.enum(['RESEARCHER', 'PARTICIPANT', 'ADMIN']).optional(),
  active: z.coerce.boolean().optional(),
});

/**
 * GET /users — List users (admin only)
 */
usersRouter.get(
  '/',
  authenticate,
  requireAdmin,
  validate({ query: listUsersQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pagination = parsePagination(req.query);
      const where: any = {};
      if ((req.query as any).role) where.role = (req.query as any).role;
      if ((req.query as any).active !== undefined) where.isActive = (req.query as any).active === 'true';

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
          select: {
            id: true,
            email: true,
            role: true,
            isEmailVerified: true,
            isActive: true,
            createdAt: true,
            // Never return passwordHash
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json(paginatedResult(users, total, pagination));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:id — Get user details (admin only)
 */
usersRouter.get(
  '/:id',
  authenticate,
  requireAdmin,
  validate({ params: userIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req.params as any).id },
        select: {
          id: true,
          email: true,
          role: true,
          isEmailVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          researcherProfile: true,
          participantProfile: {
            select: {
              id: true,
              pseudonymousId: true,
              age: true,
              qualityRating: true,
              totalRewardPoints: true,
              completedSessionsCount: true,
            },
          },
        },
      });

      if (!user) throw new NotFoundError('User not found');
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /users/:id/deactivate — Deactivate user (admin only)
 */
usersRouter.patch(
  '/:id/deactivate',
  authenticate,
  requireAdmin,
  validate({ params: userIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: (req.params as any).id } });
      if (!user) throw new NotFoundError('User not found');

      await prisma.user.update({
        where: { id: (req.params as any).id },
        data: { isActive: false },
      });

      // Revoke all sessions
      await prisma.userSession.updateMany({
        where: { userId: (req.params as any).id },
        data: { isRevoked: true },
      });

      await AuditService.record({
        actorId: req.user!.userId,
        action: AUDIT_ACTIONS.ACCOUNT_DEACTIVATED,
        resourceType: 'USER',
        resourceId: (req.params as any).id,
      });

      res.json({ message: 'User deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /users/:id/activate — Reactivate user (admin only)
 */
usersRouter.patch(
  '/:id/activate',
  authenticate,
  requireAdmin,
  validate({ params: userIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: (req.params as any).id } });
      if (!user) throw new NotFoundError('User not found');

      await prisma.user.update({
        where: { id: (req.params as any).id },
        data: { isActive: true },
      });

      await AuditService.record({
        actorId: req.user!.userId,
        action: AUDIT_ACTIONS.ACCOUNT_REACTIVATED,
        resourceType: 'USER',
        resourceId: (req.params as any).id,
      });

      res.json({ message: 'User reactivated' });
    } catch (error) {
      next(error);
    }
  }
);
