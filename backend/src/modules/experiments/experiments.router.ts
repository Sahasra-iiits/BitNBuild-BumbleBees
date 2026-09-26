// ==============================================================================
// SynapseLab — Experiment Router
// ==============================================================================

import { Router, Request } from 'express';
import { ExperimentService } from './experiments.service';
import {
  createExperimentSchema,
  updateExperimentSchema,
  experimentIdParam,
  listExperimentsQuery,
  saveDraftSchema,
} from './experiments.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate, optionalAuth } from '../../common/middleware/authenticate';
import { requireResearcher, requireParticipant } from '../../common/middleware/authorize';
import { getParam, validatedQuery } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const experimentsRouter = Router();

const researcherId = (req: Request) => req.user!.researcherProfileId!;

// =============================================================================
// Public
// =============================================================================

experimentsRouter.get(
  '/public',
  optionalAuth,
  validate({ query: listExperimentsQuery }),
  route(async (req, res) => {
    res.json(await ExperimentService.listPublic(validatedQuery(req)));
  })
);

// =============================================================================
// Researcher
// =============================================================================

experimentsRouter.get(
  '/',
  authenticate,
  requireResearcher,
  validate({ query: listExperimentsQuery }),
  route(async (req, res) => {
    res.json(await ExperimentService.listByResearcher(researcherId(req), validatedQuery(req)));
  })
);

experimentsRouter.post(
  '/',
  authenticate,
  requireResearcher,
  validate({ body: createExperimentSchema }),
  route(async (req, res) => {
    res.status(201).json(await ExperimentService.create(researcherId(req), req.body, req.user!.userId));
  })
);

/**
 * GET /experiments/:id — researchers get their own experiment; participants get a
 * public-safe view of a published/paused experiment (no answers, no rules internals).
 */
experimentsRouter.get(
  '/:id',
  authenticate,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    const id = getParam(req, 'id');
    if (req.user!.role === 'PARTICIPANT') {
      res.json(await ExperimentService.getForParticipant(id));
      return;
    }
    res.json(await ExperimentService.getForResearcher(id, req.user!.researcherProfileId, req.user!.role === 'ADMIN'));
  })
);

experimentsRouter.patch(
  '/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, body: updateExperimentSchema }),
  route(async (req, res) => {
    res.json(await ExperimentService.update(getParam(req, 'id'), researcherId(req), req.body, req.user!.userId));
  })
);

experimentsRouter.delete(
  '/:id',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    await ExperimentService.delete(getParam(req, 'id'), researcherId(req), req.user!.userId);
    res.status(204).send();
  })
);

// =============================================================================
// Draft
// =============================================================================

experimentsRouter.get(
  '/:id/draft',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    res.json(await ExperimentService.getDraft(getParam(req, 'id'), researcherId(req)));
  })
);

experimentsRouter.put(
  '/:id/draft',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam, body: saveDraftSchema }),
  route(async (req, res) => {
    res.json(await ExperimentService.saveDraft(getParam(req, 'id'), researcherId(req), req.body));
  })
);

experimentsRouter.get(
  '/:id/draft/validation',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    res.json(await ExperimentService.validateDraft(getParam(req, 'id'), researcherId(req)));
  })
);

// =============================================================================
// Lifecycle
// =============================================================================

const lifecycle = {
  publish: ExperimentService.publish.bind(ExperimentService),
  pause: ExperimentService.pause.bind(ExperimentService),
  resume: ExperimentService.resume.bind(ExperimentService),
  close: ExperimentService.close.bind(ExperimentService),
  archive: ExperimentService.archive.bind(ExperimentService),
};

for (const [action, fn] of Object.entries(lifecycle)) {
  experimentsRouter.post(
    `/:id/${action}`,
    authenticate,
    requireResearcher,
    validate({ params: experimentIdParam }),
    route(async (req, res) => {
      res.json(await fn(getParam(req, 'id'), researcherId(req), req.user!.userId));
    })
  );
}

// =============================================================================
// Participant eligibility
// =============================================================================

experimentsRouter.get(
  '/:id/eligibility',
  authenticate,
  requireParticipant,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    res.json(await ExperimentService.checkEligibility(getParam(req, 'id'), req.user!.participantProfileId!));
  })
);
