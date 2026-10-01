// ==============================================================================
// API types — mirror the backend responses exactly.
// ==============================================================================
// The experiment definition itself (trials, elements, responses) is defined once in
// src/shared/experiment and shared with the backend.

import type { ExperimentDefinition, IssueSeverity, TrialResponsePayload, ValidationIssue } from '@/shared/experiment';

export type UserRole = 'RESEARCHER' | 'PARTICIPANT' | 'ADMIN';
export type ExperimentStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export type ExperimentVisibility = 'PUBLIC' | 'PRIVATE';
export type AttemptPolicy = 'ALLOW_ONE_ATTEMPT' | 'ALLOW_MULTIPLE_ATTEMPTS';
export type SessionStatus = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXCLUDED';
export type QualityFlagStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'CONFIRMED';
export type ExportFormat = 'CSV' | 'XLSX' | 'JSON';
export type ExportStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';

// Auth ------------------------------------------------------------------------

export interface ResearcherProfile {
  id: string;
  userId: string;
  institution: string;
  department?: string | null;
  bio?: string | null;
}

export interface ParticipantProfile {
  id: string;
  pseudonymousId: string;
  /** Null for guests. */
  age: number | null;
  gender?: string | null;
  educationLevel?: string | null;
  qualityRating: number;
  totalRewardPoints: number;
  completedSessionsCount: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  /** Guest participants have no account; they can only take guest-enabled public experiments. */
  isGuest: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  researcherProfile: ResearcherProfile | null;
  participantProfile: ParticipantProfile | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'RESEARCHER' | 'PARTICIPANT';
  researcherProfile?: { institution: string; department?: string };
  participantProfile?: { age: number; gender?: string; educationLevel?: string };
}

// Experiments -----------------------------------------------------------------

export interface EligibilityRule {
  id: string;
  ruleType: 'AGE_RANGE' | 'RATING_RANGE' | 'AVAILABILITY_WINDOW' | string;
  minAge: number | null;
  maxAge: number | null;
  minRating: number | null;
  maxRating: number | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
}

export type EligibilityRuleInput =
  | { ruleType: 'AGE_RANGE'; minAge?: number; maxAge?: number }
  | { ruleType: 'RATING_RANGE'; minRating?: number; maxRating?: number }
  | { ruleType: 'AVAILABILITY_WINDOW'; availabilityStart?: string; availabilityEnd?: string };

export interface QualityRules {
  fastResponses: { enabled: boolean; thresholdMs: number; maxFraction: number; penalty: number };
  identicalResponses: { enabled: boolean; runLength: number; penalty: number };
  missedResponses: { enabled: boolean; maxFraction: number; penalty: number };
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
  createdAt: string;
}

export interface Experiment {
  id: string;
  researcherId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: ExperimentStatus;
  visibility: ExperimentVisibility;
  allowGuests: boolean;
  rewardPoints: number;
  attemptPolicy: AttemptPolicy;
  maxAttempts: number;
  qualityRules: QualityRules;
  eligibilityRules: EligibilityRule[];
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number; versions?: number };
}

export interface ExperimentDetail extends Experiment {
  versions: VersionSummary[];
  draftRevision: number;
  draftUpdatedAt: string | null;
  hasUnpublishedChanges: boolean;
}

export interface CreateExperimentRequest {
  title: string;
  description?: string;
  instructions?: string;
  visibility?: ExperimentVisibility;
  rewardPoints?: number;
}

export interface UpdateExperimentRequest {
  title?: string;
  description?: string;
  instructions?: string;
  visibility?: ExperimentVisibility;
  allowGuests?: boolean;
  rewardPoints?: number;
  attemptPolicy?: AttemptPolicy;
  maxAttempts?: number;
  eligibilityRules?: EligibilityRuleInput[];
  qualityRules?: QualityRules;
}

export interface DraftResponse {
  definition: ExperimentDefinition;
  revision: number;
  updatedAt: string | null;
  source: 'draft' | 'published_version' | 'empty';
}

export interface SaveDraftResponse {
  revision: number;
  updatedAt: string;
}

export interface DraftValidation {
  issues: ValidationIssue[];
  counts: Record<IssueSeverity, number>;
  canPublish: boolean;
}

export interface PublishResponse {
  experiment: Experiment;
  version: { id: string; versionNumber: number; created: boolean };
  warnings: ValidationIssue[];
}

export interface VersionListItem extends VersionSummary {
  configHash: string;
  trialCount: number;
  _count: { trials: number; sessions: number };
}

export interface VersionDetail extends VersionSummary {
  experimentId: string;
  definition: ExperimentDefinition;
}

/** What participants are allowed to see about an experiment. */
export interface PublicExperiment {
  id: string;
  title: string;
  description: string | null;
  instructions?: string | null;
  status?: ExperimentStatus;
  rewardPoints: number;
  allowGuests: boolean;
  attemptPolicy: AttemptPolicy;
  maxAttempts: number;
  researcher: { institution: string } | null;
  currentVersion?: { id: string; versionNumber: number } | null;
}

export interface EligibilityResult {
  eligible: boolean;
  code?: string;
  reason?: string;
  attempts?: { completed: number; maxAttempts: number; activeSessionId: string | null; canStartNew: boolean };
}

// Assets ----------------------------------------------------------------------

export interface ExperimentAsset {
  id: string;
  experimentId: string;
  kind: 'IMAGE' | 'AUDIO';
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  sha256: string;
  createdAt: string;
}

// Sessions --------------------------------------------------------------------

export interface SessionInfo {
  id: string;
  experimentId: string;
  versionId: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface StartSessionResponse {
  session: SessionInfo;
  resumed: boolean;
  version: { id: string; versionNumber: number; definition: ExperimentDefinition };
  progress: { recordedTrialIds: string[] };
}

export interface BatchEvent {
  eventId: string;
  trialId: string;
  trialSequence: number;
  stimulusDisplayTimestamp?: number;
  responseTimestamp?: number;
  reactionTimeMs: number | null;
  response: {
    advanceReason: TrialResponsePayload['advanceReason'];
    elements: Array<{ elementId: string; value: unknown; rtMs: number }>;
  };
  clientEventSequence: number;
}

export interface IngestResult {
  ingested: number;
  duplicates: number;
  total: number;
}

export interface RatingChange {
  oldRating: number;
  newRating: number;
  delta: number;
  reason: string;
}

export interface CompletionOutcome {
  session: SessionInfo;
  rewardPoints: number;
  ratingChanges: RatingChange[];
  currentRating: number;
  totalRewardPoints: number;
  qualityStatus: string | null;
  qualitySignals: string[];
}

export interface MySession {
  id: string;
  experimentId: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  qualityStatus: string | null;
  experiment: { title: string; status: ExperimentStatus };
  rewardPoints: number;
  _count: { responses: number };
}

// Results ---------------------------------------------------------------------

export interface StatSummary {
  n: number;
  participants: number;
  rtCount: number;
  meanRt: number | null;
  medianRt: number | null;
  sdRt: number | null;
  scoredCount: number;
  /** Percent 0-100. */
  accuracy: number | null;
  timeouts: number;
}

export interface ResultsResponse {
  experimentId: string;
  versionId: string | null;
  summary: {
    participants: number;
    totalSessions: number;
    completedSessions: number;
    inProgressSessions: number;
    excludedSessions: number;
    abandonedSessions: number;
    analyzedResponses: number;
  };
  conditions: Array<StatSummary & { condition: string }>;
  trials: Array<StatSummary & { trialKey: string; name: string; condition: string }>;
  computedAt: string;
}

export interface SessionListItem {
  id: string;
  pseudonymousRef: string;
  isGuest: boolean;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  qualityStatus: string | null;
  version: { versionNumber: number };
  qualitySignals: Array<{ signalType: string; severity: string; metadata: Record<string, unknown> | null }>;
  qualityFlags: Array<{ id: string; status: QualityFlagStatus; reason: string }>;
  _count: { responses: number };
}

export interface RawDataRow {
  id: string;
  participant: string;
  isGuest: boolean;
  sessionId: string;
  sessionStatus: SessionStatus;
  versionNumber: number;
  trialKey: string;
  trialName: string | null;
  trialSequence: number;
  condition: string | null;
  advanceReason: string | null;
  responses: Array<{ elementId: string; type: string; display: string; rtMs: number; correct: boolean | null }>;
  reactionTimeMs: number | null;
  correct: boolean | null;
  timeout: boolean;
  excluded: boolean;
  exclusionReason: string | null;
}

export interface RawDataResponse {
  total: number;
  limit: number;
  offset: number;
  data: RawDataRow[];
}

// Quality ---------------------------------------------------------------------

export interface QualityFlag {
  id: string;
  experimentId: string;
  sessionId: string | null;
  participant: string | null;
  reason: string;
  description: string | null;
  status: QualityFlagStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ParticipantRating {
  currentRating: number;
  totalRewardPoints: number;
  completedSessionsCount: number;
  bounds: { min: number; max: number; default: number };
  history: Array<{
    id: string;
    oldRating: number;
    delta: number;
    newRating: number;
    reason: string;
    source: string;
    experimentId: string | null;
    experimentTitle: string | null;
    createdAt: string;
  }>;
}

// Exports ---------------------------------------------------------------------

export interface ExportJob {
  id: string;
  experimentId: string;
  format: ExportFormat;
  status: ExportStatus;
  fileName: string | null;
  errorMessage: string | null;
  filters: { includeExcluded?: boolean; versionId?: string } | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  downloadable: boolean;
}

// Consent ---------------------------------------------------------------------

export interface ParticipantConsent {
  id: string;
  experimentId: string;
  versionId: string;
  consentVersion: string;
  agreedAt: string;
  withdrawnAt: string | null;
}

// Common ----------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}
