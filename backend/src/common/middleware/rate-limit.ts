// ==============================================================================
// SynapseLab — Rate Limiting Configuration
// ==============================================================================

import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

/**
 * General API rate limiter.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_GENERAL,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_MAX_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

/**
 * Event ingestion rate limiter (higher throughput).
 */
export const eventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.RATE_LIMIT_MAX_EVENTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Event submission rate exceeded. Please retry.',
    },
  },
});

/**
 * Export/heavy operation rate limiter.
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Export rate limit exceeded. Please try again later.',
    },
  },
});
