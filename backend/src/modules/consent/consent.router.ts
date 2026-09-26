// ==============================================================================
// SynapseLab — Consent Router
// ==============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ConsentService } from './consent.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireParticipant } from '../../common/middleware/authorize';

export const consentRouter = Router();

const createConsentSchema = z.object({
  experimentId: z.string().uuid(),
  versionId: z.string().uuid(),
  consentVersion: z.string().min(1).max(50),
  consentText: z.string().min(1).max(50000),
});

const consentIdParam = z.object({ id: z.string().uuid() });

/**
 * POST /consent — Record consent
 */
consentRouter.post(
  '/',
  authenticate,
  requireParticipant,
  validate({ body: createConsentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consent = await ConsentService.recordConsent(
        req.user!.participantProfileId!,
        req.body,
        req.user!.userId
      );
      res.status(201).json(consent);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /consent/:id/withdraw — Withdraw consent
 */
consentRouter.post(
  '/:id/withdraw',
  authenticate,
  requireParticipant,
  validate({ params: consentIdParam }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ConsentService.withdrawConsent(
        (req.params as any).id,
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
 * GET /consent/me — Get my consent records
 */
consentRouter.get(
  '/me',
  authenticate,
  requireParticipant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consents = await ConsentService.getParticipantConsents(
        req.user!.participantProfileId!
      );
      res.json(consents);
    } catch (error) {
      next(error);
    }
  }
);
