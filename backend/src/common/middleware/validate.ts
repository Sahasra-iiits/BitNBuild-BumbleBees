// ==============================================================================
// SynapseLab — Request Validation Middleware (Zod)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/app-error';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request body, query, and params using Zod schemas.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        next(new ValidationError(`Validation failed: ${messages.join('; ')}`));
      } else {
        next(error);
      }
    }
  };
}
