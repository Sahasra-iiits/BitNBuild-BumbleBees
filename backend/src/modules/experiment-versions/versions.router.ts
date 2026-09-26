// ==============================================================================
// SynapseLab — Experiment Versions Router
// ==============================================================================
// Versions are read-only here; they are created by POST /experiments/:id/publish,
// which validates the draft first.

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VersionService } from './versions.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';
import { getParam } from '../../common/utils/request-helpers';

export const versionsRouter = Router();

const experimentIdParam = z.object({ id: z.string().uuid() });
const versionParams = z.object({ id: z.string().uuid(), versionId: z.string().uuid() });

versionsRouter.get(
  '/:id/versions',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await VersionService.list(getParam(req, 'id'), req.user!.researcherProfileId!));
    } catch (error) {
      next(error);
    }
  }
);

versionsRouter.get(
  '/:id/versions/:versionId',
  authenticate,
  requireResearcher,
  validate({ params: versionParams }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await VersionService.getById(getParam(req, 'id'), getParam(req, 'versionId'), req.user!.researcherProfileId!));
    } catch (error) {
      next(error);
    }
  }
);
