// ==============================================================================
// SynapseLab — Sessions Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SessionService } from './sessions.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireParticipant } from '../../common/middleware/authorize';
import { eventLimiter } from '../../common/middleware/rate-limit';

export const sessionsRouter = Router();

const sessionIdParam = z.object({ sessionId: z.string().uuid() });
const experimentIdParam = z.object({ id: z.string().uuid() });

const startSessionSchema = z.object({
  consentId: z.string().uuid().optional(),
  clientMetadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

const batchEventsSchema = z.object({
  events: z.array(
    z.object({
      eventId: z.string().min(1).max(100),
      trialId: z.string().min(1),
      trialSequence: z.number().int().min(0),
      condition: z.string().optional(),
      stimulusId: z.string().optional(),
      stimulusDisplayTimestamp: z.number().optional(),
      responseTimestamp: z.number().optional(),
      reactionTimeMs: z.number().optional(),
      response: z.record(z.unknown()).optional(),
      correct: z.boolean().optional(),
      timeout: z.boolean().optional(),
      clientEventSequence: z.number().int().optional(),
    })
  ).min(1).max(500), // Cap batch size
});

/**
 * POST /experiments/:id/sessions — Start a session
 */
sessionsRouter.post(
  '/experiments/:id/sessions',
  authenticate,
  requireParticipant,
  validate({ params: experimentIdParam, body: startSessionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await SessionService.startSession(
        (req.params as any).id,
        req.user!.participantProfileId!,
        req.body.consentId,
        req.body.clientMetadata,
        req.body.idempotencyKey,
        req.user!.userId
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sessions/:sessionId/events/batch — Ingest batch events (idempotent)
 */
sessionsRouter.post(
  '/sessions/:sessionId/events/batch',
  authenticate,
  requireParticipant,
  eventLimiter,
  validate({ params: sessionIdParam, body: batchEventsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await SessionService.ingestEvents(
        (req.params as any).sessionId,
        req.body.events,
        req.user!.participantProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sessions/:sessionId/complete — Complete a session
 */
sessionsRouter.post(
  '/sessions/:sessionId/complete',
  authenticate,
  requireParticipant,
  validate({ params: sessionIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await SessionService.completeSession(
        (req.params as any).sessionId,
        req.user!.participantProfileId!,
        req.user!.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sessions/:sessionId — Get session details
 */
sessionsRouter.get(
  '/sessions/:sessionId',
  authenticate,
  validate({ params: sessionIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await SessionService.getSession((req.params as any).sessionId);

      // Verify access
      if (
        req.user!.role === 'PARTICIPANT' &&
        session.participantId !== req.user!.participantProfileId
      ) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Not your session' },
        });
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  }
);
