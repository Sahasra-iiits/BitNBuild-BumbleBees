// ==============================================================================
// SynapseLab — Quality Router
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { QualityService } from './quality.service';
import { RATING } from '../../config/constants';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher, requireParticipant } from '../../common/middleware/authorize';
import { getParam, validatedQuery } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const qualityRouter = Router();

const createFlagSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  description: z.string().trim().min(10, 'Describe the evidence (at least 10 characters)').max(5000),
  affectedTrials: z.array(z.string().min(1).max(100)).max(1000).optional(),
  evidence: z.record(z.unknown()).optional(),
});

const reviewFlagSchema = z.object({
  status: z.enum(['CONFIRMED', 'DISMISSED']),
  ratingPenalty: z.number().int().min(0).max(RATING.MAX_RESEARCHER_PENALTY).optional(),
  note: z.string().max(2000).optional(),
});

const excludeDataSchema = z.object({
  sessionId: z.string().uuid(),
  responseIds: z.array(z.string().uuid()).max(10000).optional(),
  reason: z.string().trim().min(1).max(500),
});

const flagIdParam = z.object({ id: z.string().uuid() });
const experimentIdParam = z.object({ experimentId: z.string().uuid() });
const listFlagsQuery = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'DISMISSED', 'CONFIRMED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

qualityRouter.post(
  '/flags',
  authenticate,
  requireResearcher,
  validate({ body: createFlagSchema }),
  route(async (req, res) => {
    res.status(201).json(await QualityService.createFlag(req.user!.researcherProfileId!, req.body, req.user!.userId));
  })
);

qualityRouter.post(
  '/flags/:id/review',
  authenticate,
  requireResearcher,
  validate({ params: flagIdParam, body: reviewFlagSchema }),
  route(async (req, res) => {
    res.json(await QualityService.reviewFlag(getParam(req, 'id'), req.user!.researcherProfileId!, req.body, req.user!.userId));
  })
);

qualityRouter.get(
  '/flags/experiments/:experimentId',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, query: listFlagsQuery }),
  route(async (req, res) => {
    res.json(await QualityService.listFlags(getParam(req, 'experimentId'), req.user!.researcherProfileId!, validatedQuery(req)));
  })
);

qualityRouter.get(
  '/participants/me/rating',
  authenticate,
  requireParticipant,
  route(async (req, res) => {
    res.json(await QualityService.getParticipantRating(req.user!.participantProfileId!));
  })
);

qualityRouter.post(
  '/exclude',
  authenticate,
  requireResearcher,
  validate({ body: excludeDataSchema }),
  route(async (req, res) => {
    res.json(await QualityService.excludeData(req.user!.researcherProfileId!, req.body, req.user!.userId));
  })
);
