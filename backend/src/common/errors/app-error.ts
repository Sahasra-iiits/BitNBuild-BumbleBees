// ==============================================================================
// SynapseLab — Application Errors
// ==============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  /** Safe, structured information for the client (e.g. validation issues). */
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/** The draft was saved by someone else (another tab/device) since this client loaded it. */
export class DraftConflictError extends AppError {
  constructor(details: { currentRevision: number }) {
    super('The draft was changed elsewhere. Reload to get the latest version.', 409, 'DRAFT_CONFLICT', true, details);
  }
}

export class PublishValidationError extends AppError {
  constructor(details: { issues: unknown[] }) {
    super('The experiment has validation errors that must be fixed before publishing.', 422, 'PUBLISH_VALIDATION_FAILED', true, details);
  }
}

export class SessionIncompleteError extends AppError {
  constructor(details: { missingTrials: number }) {
    super('Not all trials have been recorded for this session yet.', 409, 'SESSION_INCOMPLETE', true, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

export class NotEligibleError extends AppError {
  constructor(message = 'Participant is not eligible for this experiment') {
    super(message, 403, 'EXPERIMENT_NOT_ELIGIBLE');
  }
}

export class ExperimentStateError extends AppError {
  constructor(message = 'Invalid experiment state for this operation') {
    super(message, 409, 'EXPERIMENT_STATE_ERROR');
  }
}

export class IdempotencyError extends AppError {
  constructor(message = 'Duplicate request detected') {
    super(message, 409, 'IDEMPOTENCY_CONFLICT');
  }
}
