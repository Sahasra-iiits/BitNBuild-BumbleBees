// ==============================================================================
// SynapseLab — Auth Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['RESEARCHER', 'PARTICIPANT']),
  researcherProfile: z
    .object({
      institution: z.string().min(1).max(200).optional(),
      department: z.string().max(200).optional(),
      bio: z.string().max(1000).optional(),
    })
    .optional(),
  participantProfile: z
    .object({
      age: z.number().int().min(13).max(120),
      gender: z.string().max(50).optional(),
      educationLevel: z.string().max(100).optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
