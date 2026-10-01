// ==============================================================================
// SynapseLab — Experiment Validation Schemas
// ==============================================================================

import { z } from 'zod';
import { RATING, REWARD } from '../../config/constants';
import { qualityRulesSchema } from '../quality/quality-rules';

const eligibilityRuleSchema = z
  .object({
    ruleType: z.enum(['AGE_RANGE', 'RATING_RANGE', 'AVAILABILITY_WINDOW']),
    minAge: z.number().int().min(13).max(120).optional(),
    maxAge: z.number().int().min(13).max(120).optional(),
    minRating: z.number().min(RATING.MIN).max(RATING.MAX).optional(),
    maxRating: z.number().min(RATING.MIN).max(RATING.MAX).optional(),
    availabilityStart: z.string().datetime().optional(),
    availabilityEnd: z.string().datetime().optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.ruleType === 'AGE_RANGE') {
      if (rule.minAge === undefined && rule.maxAge === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Age rule needs a minimum or maximum age' });
      }
      if (rule.minAge !== undefined && rule.maxAge !== undefined && rule.minAge > rule.maxAge) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum age must not exceed maximum age' });
      }
    }
    if (rule.ruleType === 'RATING_RANGE') {
      if (rule.minRating === undefined && rule.maxRating === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rating rule needs a minimum or maximum rating' });
      }
      if (rule.minRating !== undefined && rule.maxRating !== undefined && rule.minRating > rule.maxRating) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum rating must not exceed maximum rating' });
      }
    }
    if (rule.ruleType === 'AVAILABILITY_WINDOW') {
      if (!rule.availabilityStart && !rule.availabilityEnd) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Availability rule needs a start or end' });
      }
      if (rule.availabilityStart && rule.availabilityEnd && rule.availabilityStart > rule.availabilityEnd) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Availability start must be before its end' });
      }
    }
  });

export type EligibilityRuleInput = z.infer<typeof eligibilityRuleSchema>;

const attemptFields = {
  attemptPolicy: z.enum(['ALLOW_ONE_ATTEMPT', 'ALLOW_MULTIPLE_ATTEMPTS']),
  maxAttempts: z.number().int().min(1).max(100),
};

export const createExperimentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  allowGuests: z.boolean().default(false),
  rewardPoints: z.number().int().min(REWARD.MIN).max(REWARD.MAX).default(0),
  attemptPolicy: attemptFields.attemptPolicy.default('ALLOW_MULTIPLE_ATTEMPTS'),
  maxAttempts: attemptFields.maxAttempts.default(100),
  eligibilityRules: z.array(eligibilityRuleSchema).max(10).optional(),
});

export const updateExperimentSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(10000).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  allowGuests: z.boolean().optional(),
  rewardPoints: z.number().int().min(REWARD.MIN).max(REWARD.MAX).optional(),
  attemptPolicy: attemptFields.attemptPolicy.optional(),
  maxAttempts: attemptFields.maxAttempts.optional(),
  /** Replaces the full rule list when present. */
  eligibilityRules: z.array(eligibilityRuleSchema).max(10).optional(),
  qualityRules: qualityRulesSchema.optional(),
});

export const saveDraftSchema = z.object({
  /** Structure is checked by the shared parser, which reports precise paths. */
  definition: z.unknown(),
  baseRevision: z.number().int().min(0),
});

export const experimentIdParam = z.object({
  id: z.string().uuid('Invalid experiment ID'),
});

export const listExperimentsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED']).optional(),
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;
