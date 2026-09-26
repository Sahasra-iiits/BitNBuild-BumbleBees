// ==============================================================================
// SynapseLab — OpenAPI Specification
// ==============================================================================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SynapseLab API',
    version: '1.0.0',
    description:
      'Production-grade API for web-based cognitive science and behavioral experiments. ' +
      'Empowers researchers to build, deploy, and analyze complex behavioral experiments in the browser.',
    contact: {
      name: 'SynapseLab Team',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      CookieAuth: {
        type: 'apiKey' as const,
        in: 'cookie' as const,
        name: 'access_token',
      },
    },
    schemas: {
      Error: {
        type: 'object' as const,
        properties: {
          error: {
            type: 'object' as const,
            properties: {
              code: { type: 'string' as const },
              message: { type: 'string' as const },
              requestId: { type: 'string' as const },
            },
          },
        },
      },
      Pagination: {
        type: 'object' as const,
        properties: {
          page: { type: 'integer' as const },
          limit: { type: 'integer' as const },
          total: { type: 'integer' as const },
          totalPages: { type: 'integer' as const },
          hasNext: { type: 'boolean' as const },
          hasPrev: { type: 'boolean' as const },
        },
      },
      RegisterRequest: {
        type: 'object' as const,
        required: ['email', 'password', 'role'],
        properties: {
          email: { type: 'string' as const, format: 'email' },
          password: { type: 'string' as const, minLength: 8 },
          role: { type: 'string' as const, enum: ['RESEARCHER', 'PARTICIPANT'] },
          researcherProfile: {
            type: 'object' as const,
            properties: {
              institution: { type: 'string' as const },
              department: { type: 'string' as const },
              bio: { type: 'string' as const },
            },
          },
          participantProfile: {
            type: 'object' as const,
            required: ['age'],
            properties: {
              age: { type: 'integer' as const, minimum: 13 },
              gender: { type: 'string' as const },
              educationLevel: { type: 'string' as const },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object' as const,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' as const, format: 'email' },
          password: { type: 'string' as const },
        },
      },
      AuthResponse: {
        type: 'object' as const,
        properties: {
          user: { type: 'object' as const },
          accessToken: { type: 'string' as const },
          refreshToken: { type: 'string' as const },
        },
      },
      Experiment: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          title: { type: 'string' as const },
          description: { type: 'string' as const },
          status: { type: 'string' as const, enum: ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED'] },
          visibility: { type: 'string' as const, enum: ['PUBLIC', 'PRIVATE'] },
          rewardPoints: { type: 'integer' as const, minimum: 0, maximum: 20 },
          attemptPolicy: { type: 'string' as const, enum: ['ALLOW_ONE_ATTEMPT', 'ALLOW_MULTIPLE_ATTEMPTS'] },
          maxAttempts: { type: 'integer' as const },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      ExperimentVersion: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          versionNumber: { type: 'integer' as const },
          configSnapshot: { type: 'object' as const },
          configHash: { type: 'string' as const },
          publishedAt: { type: 'string' as const, format: 'date-time' },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      Session: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          experimentId: { type: 'string' as const, format: 'uuid' },
          status: { type: 'string' as const, enum: ['STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXCLUDED'] },
          startedAt: { type: 'string' as const, format: 'date-time' },
          completedAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      BatchEventRequest: {
        type: 'object' as const,
        required: ['events'],
        properties: {
          events: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              required: ['eventId', 'trialId', 'trialSequence'],
              properties: {
                eventId: { type: 'string' as const },
                trialId: { type: 'string' as const, format: 'uuid' },
                trialSequence: { type: 'integer' as const },
                condition: { type: 'string' as const },
                stimulusId: { type: 'string' as const },
                stimulusDisplayTimestamp: { type: 'integer' as const },
                responseTimestamp: { type: 'integer' as const },
                reactionTimeMs: { type: 'number' as const },
                response: { type: 'object' as const },
                correct: { type: 'boolean' as const },
                timeout: { type: 'boolean' as const },
                clientEventSequence: { type: 'integer' as const },
              },
            },
          },
        },
      },
      QualityFlag: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          reason: { type: 'string' as const },
          description: { type: 'string' as const },
          status: { type: 'string' as const, enum: ['OPEN', 'REVIEWED', 'DISMISSED', 'CONFIRMED'] },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      ExportJob: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          format: { type: 'string' as const, enum: ['CSV', 'XLSX', 'JSON'] },
          status: { type: 'string' as const, enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'] },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      RatingEvent: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          oldRating: { type: 'number' as const },
          delta: { type: 'number' as const },
          newRating: { type: 'number' as const },
          reason: { type: 'string' as const },
          source: { type: 'string' as const },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      AggregateResult: {
        type: 'object' as const,
        properties: {
          condition: { type: 'string' as const },
          n: { type: 'integer' as const },
          meanRt: { type: 'number' as const },
          medianRt: { type: 'number' as const },
          stdRt: { type: 'number' as const },
          accuracy: { type: 'number' as const },
          errorRate: { type: 'number' as const },
        },
      },
    },
  },
  paths: {
    // =========================================================================
    // Authentication
    // =========================================================================
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          '201': { description: 'User registered successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout and revoke session',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Logged out successfully' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        responses: {
          '200': { description: 'Token refreshed', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } } },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user profile',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Current user' }, '401': { description: 'Not authenticated' } },
      },
    },
    // =========================================================================
    // Experiments
    // =========================================================================
    '/experiments': {
      get: {
        tags: ['Experiments'],
        summary: 'List researcher experiments',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query' as const, schema: { type: 'integer' as const } },
          { name: 'limit', in: 'query' as const, schema: { type: 'integer' as const } },
          { name: 'status', in: 'query' as const, schema: { type: 'string' as const } },
        ],
        responses: { '200': { description: 'List of experiments' } },
      },
      post: {
        tags: ['Experiments'],
        summary: 'Create a new experiment',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Experiment' } } } },
        responses: { '201': { description: 'Experiment created' } },
      },
    },
    '/experiments/public': {
      get: {
        tags: ['Experiments'],
        summary: 'List public experiments available to participants',
        parameters: [
          { name: 'page', in: 'query' as const, schema: { type: 'integer' as const } },
          { name: 'limit', in: 'query' as const, schema: { type: 'integer' as const } },
        ],
        responses: { '200': { description: 'Public experiment listing' } },
      },
    },
    '/experiments/{id}': {
      get: {
        tags: ['Experiments'],
        summary: 'Get experiment details',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const, format: 'uuid' } }],
        responses: { '200': { description: 'Experiment details' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Experiments'],
        summary: 'Update experiment (draft only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Updated' }, '409': { description: 'Cannot modify non-draft experiment' } },
      },
      delete: {
        tags: ['Experiments'],
        summary: 'Delete experiment (draft only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/experiments/{id}/publish': {
      post: {
        tags: ['Experiments'],
        summary: 'Publish experiment (creates immutable version)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Published' } },
      },
    },
    '/experiments/{id}/pause': {
      post: {
        tags: ['Experiments'],
        summary: 'Pause a published experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Paused' } },
      },
    },
    '/experiments/{id}/close': {
      post: {
        tags: ['Experiments'],
        summary: 'Close an experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Closed' } },
      },
    },
    '/experiments/{id}/archive': {
      post: {
        tags: ['Experiments'],
        summary: 'Archive a closed experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Archived' } },
      },
    },
    '/experiments/{id}/eligibility': {
      get: {
        tags: ['Experiments'],
        summary: 'Check participant eligibility for experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Eligibility result' } },
      },
    },
    // =========================================================================
    // Versions
    // =========================================================================
    '/experiments/{id}/versions': {
      get: {
        tags: ['Experiment Versions'],
        summary: 'List versions of an experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Version list' } },
      },
      post: {
        tags: ['Experiment Versions'],
        summary: 'Create a new version with trials/logic/randomization',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '201': { description: 'Version created' } },
      },
    },
    '/experiments/{id}/versions/{versionId}': {
      get: {
        tags: ['Experiment Versions'],
        summary: 'Get full version configuration (immutable snapshot)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } },
          { name: 'versionId', in: 'path' as const, required: true, schema: { type: 'string' as const } },
        ],
        responses: { '200': { description: 'Version details' } },
      },
    },
    // =========================================================================
    // Sessions
    // =========================================================================
    '/experiments/{id}/sessions': {
      post: {
        tags: ['Sessions'],
        summary: 'Start a new experiment session',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: {
          '201': { description: 'Session started', content: { 'application/json': { schema: { $ref: '#/components/schemas/Session' } } } },
          '403': { description: 'Not eligible' },
          '409': { description: 'Attempt limit reached' },
        },
      },
    },
    '/sessions/{sessionId}/events/batch': {
      post: {
        tags: ['Sessions'],
        summary: 'Submit batch of trial response events (idempotent)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/BatchEventRequest' } } } },
        responses: {
          '200': { description: 'Events ingested' },
          '409': { description: 'Duplicate events detected' },
        },
      },
    },
    '/sessions/{sessionId}/complete': {
      post: {
        tags: ['Sessions'],
        summary: 'Mark session as completed',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'sessionId', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Session completed' } },
      },
    },
    // =========================================================================
    // Results
    // =========================================================================
    '/results/experiments/{id}': {
      get: {
        tags: ['Results'],
        summary: 'Get aggregate results for an experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Aggregate results' } },
      },
    },
    '/results/experiments/{id}/participants': {
      get: {
        tags: ['Results'],
        summary: 'List participants for an experiment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Participant list' } },
      },
    },
    // =========================================================================
    // Quality & Ratings
    // =========================================================================
    '/quality/flags': {
      post: {
        tags: ['Quality'],
        summary: 'Create a quality flag for a participant/session',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/QualityFlag' } } } },
        responses: { '201': { description: 'Flag created' } },
      },
    },
    '/quality/flags/{id}/review': {
      post: {
        tags: ['Quality'],
        summary: 'Review a quality flag',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Flag reviewed' } },
      },
    },
    '/quality/participants/me/rating': {
      get: {
        tags: ['Quality'],
        summary: 'Get current participant rating',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Current rating and history' } },
      },
    },
    // =========================================================================
    // Exports
    // =========================================================================
    '/exports': {
      post: {
        tags: ['Exports'],
        summary: 'Request data export (async)',
        security: [{ BearerAuth: [] }],
        responses: {
          '202': { description: 'Export job created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExportJob' } } } },
        },
      },
    },
    '/exports/{id}': {
      get: {
        tags: ['Exports'],
        summary: 'Get export job status and download link',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Export status' } },
      },
    },
    // =========================================================================
    // Consent
    // =========================================================================
    '/consent': {
      post: {
        tags: ['Consent'],
        summary: 'Record participant consent',
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Consent recorded' } },
      },
    },
    '/consent/{id}/withdraw': {
      post: {
        tags: ['Consent'],
        summary: 'Withdraw consent',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }],
        responses: { '200': { description: 'Consent withdrawn' } },
      },
    },
  },
  tags: [
    { name: 'Authentication', description: 'Registration, login, token management' },
    { name: 'Experiments', description: 'Experiment CRUD and lifecycle management' },
    { name: 'Experiment Versions', description: 'Immutable experiment version management' },
    { name: 'Sessions', description: 'Participant experiment sessions and event ingestion' },
    { name: 'Results', description: 'Aggregate results and data access' },
    { name: 'Quality', description: 'Quality signals, flags, and participant ratings' },
    { name: 'Exports', description: 'Async data export in CSV/XLSX/JSON' },
    { name: 'Consent', description: 'Participant consent records' },
  ],
};
