// ==============================================================================
// SynapseLab — Experiment Versions Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VersionService } from './versions.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';

export const versionsRouter = Router();

const experimentIdParam = z.object({ id: z.string().uuid() });
const versionParams = z.object({ id: z.string().uuid(), versionId: z.string().uuid() });

const createVersionSchema = z.object({
  trials: z.array(z.record(z.unknown())).optional(),
  logicRules: z
    .array(
      z.object({
        sourceTrialId: z.string().uuid().optional(),
        targetTrialId: z.string().uuid().optional(),
        conditionType: z.string().min(1),
        condition: z.record(z.unknown()),
        priority: z.number().int().optional(),
      })
    )
    .optional(),
  randomization: z
    .array(
      z.object({
        strategy: z.string().min(1),
        seed: z.string().optional(),
        configuration: z.record(z.unknown()),
      })
    )
    .optional(),
});

/**
 * GET /experiments/:id/versions — List versions
 */
versionsRouter.get(
  '/:id/versions',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versions = await VersionService.list(
        (req.params as any).id,
        req.user!.researcherProfileId!
      );
      res.json(versions);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /experiments/:id/versions — Create new version
 */
versionsRouter.post(
  '/:id/versions',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, body: createVersionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const version = await VersionService.create(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.status(201).json(version);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /experiments/:id/versions/:versionId — Get version details
 */
versionsRouter.get(
  '/:id/versions/:versionId',
  authenticate,
  validate({ params: versionParams }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const researcherProfileId =
        req.user!.role === 'RESEARCHER' ? req.user!.researcherProfileId : undefined;
      const version = await VersionService.getById(
        (req.params as any).id,
        (req.params as any).versionId,
        researcherProfileId
      );
      res.json(version);
    } catch (error) {
      next(error);
    }
  }
);
