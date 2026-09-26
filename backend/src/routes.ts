// ==============================================================================
// SynapseLab — API Router
// ==============================================================================
// All versioned API routes are mounted here under /api/v1.

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { experimentsRouter } from './modules/experiments/experiments.router';
import { versionsRouter } from './modules/experiment-versions/versions.router';
import { consentRouter } from './modules/consent/consent.router';
import { sessionsRouter } from './modules/sessions/sessions.router';
import { qualityRouter } from './modules/quality/quality.router';
import { resultsRouter } from './modules/results/results.router';
import { exportsRouter } from './modules/exports/exports.router';

export const apiRouter = Router();

// =============================================================================
// OpenAPI Documentation
// =============================================================================
apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SynapseLab API Documentation',
}));

apiRouter.get('/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// =============================================================================
// Module Routes
// =============================================================================
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/experiments', experimentsRouter);
apiRouter.use('/experiments', versionsRouter);
apiRouter.use('/consent', consentRouter);
// Sessions: handles both /sessions/:id/... AND /experiments/:id/sessions via the router
apiRouter.use('/', sessionsRouter);
apiRouter.use('/quality', qualityRouter);
apiRouter.use('/results', resultsRouter);
apiRouter.use('/exports', exportsRouter);
