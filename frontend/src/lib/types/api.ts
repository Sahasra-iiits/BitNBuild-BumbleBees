// ==============================================================================
// CogniScale Frontend — API Types (synchronized with backend OpenAPI)
// ==============================================================================
// Source of truth: backend OpenAPI spec + Prisma schema
// All enums match backend UPPERCASE conventions exactly.
// DO NOT manually calculate rating/reward changes here.

// =============================================================================
// Enums (match backend Prisma/OpenAPI exactly)
// =============================================================================

export type UserRole = 'RESEARCHER' | 'PARTICIPANT' | 'ADMIN';
export type ExperimentStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export type ExperimentVisibility = 'PUBLIC' | 'PRIVATE';
export type AttemptPolicy = 'ALLOW_ONE_ATTEMPT' | 'ALLOW_MULTIPLE_ATTEMPTS';
export type SessionStatus = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXCLUDED';
export type QualityFlagStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'CONFIRMED';
export type ExportFormat = 'CSV' | 'XLSX' | 'JSON';
export type ExportStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';

// =============================================================================
// Auth
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  researcherProfile?: ResearcherProfile;
  participantProfile?: ParticipantProfile;
  createdAt: string;
}

export interface ResearcherProfile {
  id: string;
  userId: string;
  institution: string;
  department?: string;
  bio?: string;
}

export interface ParticipantProfile {
  id: string;
  userId: string;
  pseudonymousId: string;
  age: number;
  gender?: string;
  educationLevel?: string;
  qualityRating: number;
  totalRewardPoints: number;
  completedSessionsCount: number;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string; // Also set as HTTP-only cookie
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'RESEARCHER' | 'PARTICIPANT';
  researcherProfile?: {
    institution: string;
    department?: string;
    bio?: string;
  };
  participantProfile?: {
    age: number;
    gender?: string;
    educationLevel?: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

// =============================================================================
// Experiments
// =============================================================================

export interface Experiment {
  id: string;
  researcherId: string;
  title: string;
  description?: string;
  instructions?: string;
  status: ExperimentStatus;
  visibility: ExperimentVisibility;
  rewardPoints: number;
  attemptPolicy: AttemptPolicy;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  // Computed/joined fields (may be present in list responses)
  _count?: {
    sessions: number;
  };
  eligibilityRules?: EligibilityRule[];
}

export interface CreateExperimentRequest {
  title: string;
  description?: string;
  instructions?: string;
  visibility?: ExperimentVisibility;
  rewardPoints?: number;
  attemptPolicy?: AttemptPolicy;
  maxAttempts?: number;
}

export interface UpdateExperimentRequest extends Partial<CreateExperimentRequest> {}

// =============================================================================
// Experiment Versions (immutable after publish)
// =============================================================================

export interface ExperimentVersion {
  id: string;
  experimentId: string;
  versionNumber: number;
  configSnapshot: ExperimentConfigSnapshot;
  configHash: string;
  publishedAt?: string;
  createdAt: string;
  trials?: ExperimentTrial[];
  logicRules?: LogicRule[];
  randomization?: RandomizationConfig[];
}

export interface ExperimentConfigSnapshot {
  trials: ExperimentTrial[];
  logicRules: LogicRule[];
  randomization: RandomizationConfig[];
}

export interface ExperimentTrial {
  id: string;
  versionId: string;
  sequenceOrder: number;
  trialType: string;
  name?: string;
  configuration: Record<string, unknown>;
  stimulusConfig?: Record<string, unknown>;
  durationMs?: number;
  timeoutMs?: number;
  elements?: TrialElement[];
}

export interface TrialElement {
  id: string;
  trialId: string;
  elementType: string;
  configuration: Record<string, unknown>;
  sequenceOrder: number;
}

export interface LogicRule {
  id: string;
  versionId: string;
  sourceTrialId?: string;
  targetTrialId?: string;
  conditionType: string;
  condition: Record<string, unknown>;
  priority: number;
}

export interface RandomizationConfig {
  id: string;
  versionId: string;
  strategy: string;
  seed?: string;
  configuration: Record<string, unknown>;
}

export interface CreateVersionRequest {
  trials?: Array<{
    sequenceOrder: number;
    trialType: string;
    name?: string;
    configuration: Record<string, unknown>;
    stimulusConfig?: Record<string, unknown>;
    durationMs?: number;
    timeoutMs?: number;
    elements?: Array<{
      elementType: string;
      configuration: Record<string, unknown>;
      sequenceOrder: number;
    }>;
  }>;
  logicRules?: Array<{
    sourceTrialId?: string;
    targetTrialId?: string;
    conditionType: string;
    condition: Record<string, unknown>;
    priority?: number;
  }>;
  randomization?: Array<{
    strategy: string;
    seed?: string;
    configuration: Record<string, unknown>;
  }>;
}

// =============================================================================
// Eligibility
// =============================================================================

export interface EligibilityRule {
  id: string;
  experimentId: string;
  ruleType: string;
  minAge?: number;
  maxAge?: number;
  minRating?: number;
  maxRating?: number;
  maxAttempts?: number;
  availabilityStart?: string;
  availabilityEnd?: string;
  configuration?: Record<string, unknown>;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  code?: string; // e.g., RATING_TOO_LOW, AGE_NOT_MET, ATTEMPT_LIMIT_REACHED
}

// =============================================================================
// Sessions
// =============================================================================

export interface ExperimentSession {
  id: string;
  experimentId: string;
  versionId: string;
  participantId: string;
  pseudonymousRef: string;
  consentId?: string;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
  qualityStatus?: string;
  // Full version config returned with session start for local execution
  version?: ExperimentVersion;
}

export interface StartSessionRequest {
  consentId?: string;
  clientMetadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface StartSessionResponse extends ExperimentSession {
  version: ExperimentVersion; // Always returned for experiment runner
}

// =============================================================================
// Trial Response Events (for batch ingestion)
// =============================================================================

export interface BatchEvent {
  eventId: string; // Client-generated UUID for idempotency
  trialId: string;
  trialSequence: number;
  condition?: string;
  stimulusId?: string;
  stimulusDisplayTimestamp?: number; // High-precision ms since epoch (performance.now() base)
  responseTimestamp?: number;
  reactionTimeMs?: number; // Client-computed
  response?: Record<string, unknown>;
  correct?: boolean;
  timeout?: boolean;
  clientEventSequence?: number;
}

export interface BatchEventRequest {
  events: BatchEvent[];
}

// =============================================================================
// Quality
// =============================================================================

export interface QualityFlag {
  id: string;
  participantId: string;
  experimentId: string;
  sessionId?: string;
  researcherId: string;
  reason: string;
  description?: string;
  affectedTrials?: string[];
  evidence?: Record<string, unknown>;
  status: QualityFlagStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface CreateQualityFlagRequest {
  participantId: string;
  experimentId: string;
  sessionId?: string;
  reason: string;
  description?: string;
  affectedTrials?: string[];
  evidence?: Record<string, unknown>;
}

export interface ReviewFlagRequest {
  status: 'REVIEWED' | 'DISMISSED' | 'CONFIRMED';
  ratingDelta?: number;
}

export interface ParticipantRating {
  currentRating: number;
  totalRewardPoints: number;
  completedSessionsCount: number;
  history: ParticipantRatingEvent[];
}

export interface ParticipantRatingEvent {
  id: string;
  oldRating: number;
  delta: number;
  newRating: number;
  reason: string;
  source: string;
  experimentId?: string;
  createdAt: string;
}

// =============================================================================
// Results
// =============================================================================

export interface AggregateResult {
  condition: string;
  n: number;
  meanRt?: number;
  medianRt?: number;
  stdRt?: number;
  accuracy?: number;
  errorRate?: number;
}

export interface ExperimentResultSummary {
  experimentId: string;
  totalSessions: number;
  completedSessions: number;
  excludedSessions: number;
  aggregates: AggregateResult[];
  computedAt: string;
}

export interface RawTrialResponse {
  id: string;
  sessionId: string;
  trialId: string;
  eventId: string;
  trialSequence: number;
  condition?: string;
  stimulusId?: string;
  stimulusDisplayTimestamp?: string; // BigInt as string
  responseTimestamp?: string;
  reactionTimeMs?: number;
  response?: Record<string, unknown>;
  correct?: boolean;
  timeout: boolean;
  excluded: boolean;
  exclusionReason?: string;
  createdAt: string;
}

// =============================================================================
// Exports
// =============================================================================

export interface ExportJob {
  id: string;
  researcherId: string;
  experimentId: string;
  format: ExportFormat;
  status: ExportStatus;
  filePath?: string;
  fileName?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string; // Signed URL when status === 'READY'
}

export interface CreateExportRequest {
  experimentId: string;
  format: ExportFormat;
  filters?: {
    includeExcluded?: boolean;
    versionId?: string;
  };
  idempotencyKey?: string;
}

// =============================================================================
// Consent
// =============================================================================

export interface RecordConsentRequest {
  experimentId: string;
  versionId: string;
  consentVersion: string;
  consentTextHash: string;
}

export interface ParticipantConsent {
  id: string;
  participantId: string;
  experimentId: string;
  versionId: string;
  consentVersion: string;
  agreedAt: string;
  withdrawnAt?: string;
}

// =============================================================================
// Pagination
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// API Errors
// =============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

// Error codes from backend
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'EXPERIMENT_NOT_ELIGIBLE'
  | 'EXPERIMENT_CLOSED'
  | 'EXPERIMENT_PAUSED'
  | 'ATTEMPT_LIMIT_REACHED'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'DUPLICATE_EVENT';
