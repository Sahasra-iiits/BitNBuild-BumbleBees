// ==============================================================================
// SynapseLab — Quality Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QualityService } from './quality.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher, requireParticipant } from '../../common/middleware/authorize';

export const qualityRouter = Router();

const createFlagSchema = z.object({
  participantId: z.string().uuid(),
  experimentId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  reason: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  affectedTrials: z.array(z.string().uuid()).optional(),
  evidence: z.record(z.unknown()).optional(),
});

const reviewFlagSchema = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED', 'CONFIRMED']),
  ratingDelta: z.number().min(-50).max(50).optional(),
});

const excludeDataSchema = z.object({
  sessionId: z.string().uuid(),
  responseIds: z.array(z.string().uuid()).optional(),
  reason: z.string().min(1).max(500),
});

const flagIdParam = z.object({ id: z.string().uuid() });
const experimentIdParam = z.object({ experimentId: z.string().uuid() });

/**
 * POST /quality/flags — Create a quality flag
 */
qualityRouter.post(
  '/flags',
  authenticate,
  requireResearcher,
  validate({ body: createFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await QualityService.createFlag(
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.status(201).json(flag);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /quality/flags/:id/review — Review a quality flag
 */
qualityRouter.post(
  '/flags/:id/review',
  authenticate,
  requireResearcher,
  validate({ params: flagIdParam, body: reviewFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await QualityService.reviewFlag(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /quality/flags/experiments/:experimentId — List flags for an experiment
 */
qualityRouter.get(
  '/flags/experiments/:experimentId',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await QualityService.listFlags(
        (req.params as any).experimentId,
        req.user!.researcherProfileId!,
        req.query
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /quality/participants/me/rating — Get participant's own rating
 */
qualityRouter.get(
  '/participants/me/rating',
  authenticate,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await QualityService.getParticipantRating(
        req.user!.participantProfileId!
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /quality/exclude — Exclude data (non-destructive)
 */
qualityRouter.post(
  '/exclude',
  authenticate,
  requireResearcher,
  validate({ body: excludeDataSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await QualityService.excludeData(
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
