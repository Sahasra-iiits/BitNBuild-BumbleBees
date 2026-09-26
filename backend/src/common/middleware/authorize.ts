// ==============================================================================
// SynapseLab — Authorization Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { UserRole } from '../../config/constants';

/**
 * Restrict access to specific roles.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }

    next();
  };
}

/**
 * Require researcher role with profile.
 */
export function requireResearcher(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== 'RESEARCHER' && req.user.role !== 'ADMIN') {
    return next(new ForbiddenError('Researcher access required'));
  }

  if (!req.user.researcherProfileId && req.user.role !== 'ADMIN') {
    return next(new ForbiddenError('Researcher profile not configured'));
  }

  next();
}

/**
 * Require participant role with profile.
 */
export function requireParticipant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== 'PARTICIPANT') {
    return next(new ForbiddenError('Participant access required'));
  }

  if (!req.user.participantProfileId) {
    return next(new ForbiddenError('Participant profile not configured'));
  }

  next();
}

/**
 * Require admin role.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== 'ADMIN') {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
}
