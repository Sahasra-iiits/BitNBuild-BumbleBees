// ==============================================================================
// SynapseLab — Sessions Router
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { SessionService } from './sessions.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireParticipant } from '../../common/middleware/authorize';
import { eventLimiter } from '../../common/middleware/rate-limit';
import { getParam } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const sessionsRouter = Router();

const sessionIdParam = z.object({ sessionId: z.string().uuid() });
const experimentIdParam = z.object({ id: z.string().uuid() });

const startSessionSchema = z.object({
  consentId: z.string().uuid().optional(),
  clientMetadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

const timestamp = z.number().finite().nonnegative();

const batchEventsSchema = z.object({
  events: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        trialId: z.string().min(1).max(100),
        trialSequence: z.number().int().min(0),
        stimulusDisplayTimestamp: timestamp.optional(),
        responseTimestamp: timestamp.optional(),
        reactionTimeMs: z.number().finite().nonnegative().nullable().optional(),
        response: z.object({
          advanceReason: z.enum(['response', 'submit', 'continue', 'timeout']),
          elements: z
            .array(
              z.object({
                elementId: z.string().min(1).max(100),
                value: z.unknown(),
                rtMs: z.number().finite().nonnegative(),
              })
            )
            .max(50),
        }),
        clientEventSequence: z.number().int().min(0).optional(),
      })
    )
    .min(1)
    .max(500),
});

sessionsRouter.post(
  '/experiments/:id/sessions',
  authenticate,
  requireParticipant,
  validate({ params: experimentIdParam, body: startSessionSchema }),
  route(async (req, res) => {
    const result = await SessionService.startSession(getParam(req, 'id'), req.user!.participantProfileId!, req.body, req.user!.userId);
    res.status(result.resumed ? 200 : 201).json(result);
  })
);

sessionsRouter.get(
  '/sessions/me',
  authenticate,
  requireParticipant,
  route(async (req, res) => {
    res.json(await SessionService.listMine(req.user!.participantProfileId!));
  })
);

sessionsRouter.post(
  '/sessions/:sessionId/events/batch',
  authenticate,
  requireParticipant,
  eventLimiter,
  validate({ params: sessionIdParam, body: batchEventsSchema }),
  route(async (req, res) => {
    res.json(await SessionService.ingestEvents(getParam(req, 'sessionId'), req.body.events, req.user!.participantProfileId!, req.user!.userId));
  })
);

sessionsRouter.post(
  '/sessions/:sessionId/complete',
  authenticate,
  requireParticipant,
  validate({ params: sessionIdParam }),
  route(async (req, res) => {
    res.json(await SessionService.completeSession(getParam(req, 'sessionId'), req.user!.participantProfileId!, req.user!.userId));
  })
);

sessionsRouter.get(
  '/sessions/:sessionId',
  authenticate,
  validate({ params: sessionIdParam }),
  route(async (req, res) => {
    res.json(
      await SessionService.getSession(getParam(req, 'sessionId'), {
        role: req.user!.role,
        participantProfileId: req.user!.participantProfileId,
        researcherProfileId: req.user!.researcherProfileId,
      })
    );
  })
);
