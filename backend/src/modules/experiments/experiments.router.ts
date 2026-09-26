// ==============================================================================
// SynapseLab — Experiment Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { ExperimentService } from './experiments.service';
import {
  createExperimentSchema,
  updateExperimentSchema,
  experimentIdParam,
  listExperimentsQuery,
} from './experiments.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate, optionalAuth } from '../../common/middleware/authenticate';
import { requireResearcher, requireParticipant } from '../../common/middleware/authorize';

export const experimentsRouter = Router();

// =============================================================================
// Public Endpoints
// =============================================================================

/**
 * GET /experiments/public — List publicly available experiments
 */
experimentsRouter.get(
  '/public',
  optionalAuth,
  validate({ query: listExperimentsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.listPublic(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Researcher Endpoints
// =============================================================================

/**
 * GET /experiments — List researcher's own experiments
 */
experimentsRouter.get(
  '/',
  authenticate,
  requireResearcher,
  validate({ query: listExperimentsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.listByResearcher(
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
 * POST /experiments — Create a new experiment
 */
experimentsRouter.post(
  '/',
  authenticate,
  requireResearcher,
  validate({ body: createExperimentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await ExperimentService.create(
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.status(201).json(experiment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /experiments/:id — Get experiment details
 */
experimentsRouter.get(
  '/:id',
  authenticate,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Researchers see their own; participants see public published
      const researcherProfileId =
        req.user!.role === 'RESEARCHER' ? req.user!.researcherProfileId : undefined;

      const experiment = await ExperimentService.getById(
        (req.params as any).id,
        researcherProfileId
      );

      // Participants can only see published public experiments
      if (req.user!.role === 'PARTICIPANT') {
        if (experiment.status !== 'PUBLISHED') {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Experiment not found' } });
        }
        if (experiment.visibility === 'PRIVATE') {
          // Allow via private link — but strip internal data
        }
      }

      res.json(experiment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /experiments/:id — Update experiment (draft only)
 */
experimentsRouter.patch(
  '/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, body: updateExperimentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await ExperimentService.update(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.body,
        req.user!.userId
      );
      res.json(experiment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /experiments/:id — Delete experiment (draft only)
 */
experimentsRouter.delete(
  '/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ExperimentService.delete(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.user!.userId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Lifecycle Endpoints
// =============================================================================

/**
 * POST /experiments/:id/publish
 */
experimentsRouter.post(
  '/:id/publish',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.publish(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /experiments/:id/pause
 */
experimentsRouter.post(
  '/:id/pause',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.pause(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /experiments/:id/close
 */
experimentsRouter.post(
  '/:id/close',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.close(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /experiments/:id/archive
 */
experimentsRouter.post(
  '/:id/archive',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.archive(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /experiments/:id/eligibility — Check participant eligibility
 */
experimentsRouter.get(
  '/:id/eligibility',
  authenticate,
  requireParticipant,
  validate({ params: experimentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ExperimentService.checkEligibility(
        (req.params as any).id,
        req.user!.participantProfileId!
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
