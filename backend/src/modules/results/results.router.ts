// ==============================================================================
// SynapseLab — Results Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ResultsService } from './results.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';

export const resultsRouter = Router();

const experimentIdParam = z.object({ id: z.string().uuid() });
const resultsQuery = z.object({
  versionId: z.string().uuid().optional(),
});
const participantsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
});
const rawDataQuery = z.object({
  includeExcluded: z.coerce.boolean().optional(),
  versionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /results/experiments/:id — Get aggregate results
 */
resultsRouter.get(
  '/experiments/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: resultsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await ResultsService.getAggregateResults(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        (req.query as any).versionId as string | undefined
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /results/experiments/:id/participants — List participants
 */
resultsRouter.get(
  '/experiments/:id/participants',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: participantsQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ResultsService.listParticipants(
        (req.params as any).id,
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
 * GET /results/experiments/:id/data — Get raw data
 */
resultsRouter.get(
  '/experiments/:id/data',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: rawDataQuery }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ResultsService.getRawData(
        (req.params as any).id,
        req.user!.researcherProfileId!,
        {
          includeExcluded: (req.query as any).includeExcluded === 'true',
          versionId: (req.query as any).versionId as string | undefined,
          limit: Number((req.query as any).limit) || undefined,
          offset: Number((req.query as any).offset) || undefined,
        }
      );
      res.json({ data, count: data.length });
    } catch (error) {
      next(error);
    }
  }
);
