// ==============================================================================
// SynapseLab — Express Request Helpers
// ==============================================================================
// Express v5 types params/query values as string | string[] | ParsedQs; these
// helpers return plain strings after the validate() middleware has run.

import { Request } from 'express';

export function getParam(req: Request, key: string): string {
  const val = (req.params as Record<string, unknown>)[key];
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : '';
  return typeof val === 'string' ? val : '';
}

export function getQuery(req: Request, key: string): string | undefined {
  const val = (req.query as Record<string, unknown>)[key];
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : undefined;
  return typeof val === 'string' ? val : undefined;
}

/** Validated query object (validate({ query }) replaces req.query with the parsed value). */
export function validatedQuery<T>(req: Request): T {
  return req.query as unknown as T;
}
