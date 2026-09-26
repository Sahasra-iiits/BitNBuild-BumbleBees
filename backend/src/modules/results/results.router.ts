// ==============================================================================
// SynapseLab — Results Router
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { ResultsService } from './results.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';
import { getParam, validatedQuery } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const resultsRouter = Router();

const experimentIdParam = z.object({ id: z.string().uuid() });
const resultsQuery = z.object({ versionId: z.string().uuid().optional() });
const participantsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXCLUDED']).optional(),
});
// z.coerce.boolean() turns the string "false" into true; parse the literal instead.
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');
const rawDataQuery = z.object({
  includeExcluded: booleanString.optional(),
  versionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

resultsRouter.get(
  '/experiments/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: resultsQuery }),
  route(async (req, res) => {
    const q = validatedQuery<z.infer<typeof resultsQuery>>(req);
    res.json(await ResultsService.getAggregateResults(getParam(req, 'id'), req.user!.researcherProfileId!, q.versionId));
  })
);

resultsRouter.get(
  '/experiments/:id/participants',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: participantsQuery }),
  route(async (req, res) => {
    res.json(await ResultsService.listParticipants(getParam(req, 'id'), req.user!.researcherProfileId!, validatedQuery(req)));
  })
);

resultsRouter.get(
  '/experiments/:id/data',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: rawDataQuery }),
  route(async (req, res) => {
    const q = validatedQuery<z.infer<typeof rawDataQuery>>(req);
    res.json(
      await ResultsService.getRawData(getParam(req, 'id'), req.user!.researcherProfileId!, {
        includeExcluded: q.includeExcluded ?? false,
        versionId: q.versionId,
        limit: q.limit,
        offset: q.offset,
      })
    );
  })
);
