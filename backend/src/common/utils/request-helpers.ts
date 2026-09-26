// ==============================================================================
// SynapseLab — Express Request Helpers
// ==============================================================================
// Helper to safely extract typed params from Express v5 requests.

import { Request } from 'express';

/**
 * Safely extract a string parameter from req.params.
 * Express v5 types params as string | string[]. This helper handles both.
 */
export function getParam(req: Request, key: string): string {
  const val = (req.params as Record<string, any>)[key];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : String(val || '');
}

/**
 * Safely extract a string query parameter.
 */
export function getQuery(req: Request, key: string): string | undefined {
  const val = req.query[key];
  if (Array.isArray(val)) return val[0] as string;
  return val as string | undefined;
}
