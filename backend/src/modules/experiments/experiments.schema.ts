// ==============================================================================
// SynapseLab — Experiment Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createExperimentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  rewardPoints: z.number().int().min(0).max(20).default(0),
  attemptPolicy: z.enum(['ALLOW_ONE_ATTEMPT', 'ALLOW_MULTIPLE_ATTEMPTS']).default('ALLOW_ONE_ATTEMPT'),
  maxAttempts: z.number().int().min(1).max(100).default(1),
  eligibilityRules: z
    .array(
      z.object({
        ruleType: z.enum(['AGE_RANGE', 'RATING_RANGE', 'ATTEMPT_LIMIT', 'AVAILABILITY_WINDOW', 'CUSTOM']),
        minAge: z.number().int().min(0).optional(),
        maxAge: z.number().int().max(150).optional(),
        minRating: z.number().min(0).max(100).optional(),
        maxRating: z.number().min(0).max(100).optional(),
        maxAttempts: z.number().int().min(1).optional(),
        availabilityStart: z.string().datetime().optional(),
        availabilityEnd: z.string().datetime().optional(),
        configuration: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});

export const updateExperimentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  rewardPoints: z.number().int().min(0).max(20).optional(),
  attemptPolicy: z.enum(['ALLOW_ONE_ATTEMPT', 'ALLOW_MULTIPLE_ATTEMPTS']).optional(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
});

export const experimentIdParam = z.object({
  id: z.string().uuid('Invalid experiment ID'),
});

export const listExperimentsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;
