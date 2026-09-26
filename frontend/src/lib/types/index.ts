export type UserRole = 'researcher' | 'participant' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  createdAt: string;
}

export type ExperimentStatus = 'draft' | 'published' | 'paused' | 'closed' | 'archived';
export type ExperimentVisibility = 'private' | 'public';

export interface Experiment {
  id: string;
  researcherId: string;
  title: string;
  description: string;
  status: ExperimentStatus;
  visibility: ExperimentVisibility;
  version: number;
  category?: string;
  durationMinutes?: number;
  
  // Eligibility
  ageRequirement?: {
    enabled: boolean;
    minAge?: number;
    maxAge?: number;
  };
  ratingRequirement?: {
    enabled: boolean;
    minRating?: number;
  };
  multipleAttempts: {
    allowed: boolean;
    maxAttempts?: number;
  };
  rewardPoints: number;

  createdAt: string;
  updatedAt: string;
}

export type ElementType = 'text' | 'image' | 'video' | 'audio' | 'fixation' | 'instruction' | 'question' | 'multiple_choice' | 'keyboard_response' | 'mouse_response' | 'slider' | 'timer' | 'condition' | 'randomizer' | 'end';

export interface TrialElement {
  id: string;
  type: ElementType;
  properties: Record<string, any>;
  position?: { x: number; y: number }; // For visual builder
}

export interface Trial {
  id: string;
  name: string;
  elements: TrialElement[];
  stimulusDurationMs?: number; // 0 means infinite
  responseWindowMs?: number;
  allowedResponses?: string[];
  correctResponse?: string;
  feedback?: {
    correct?: string;
    incorrect?: string;
  };
  metadata?: Record<string, any>;
}

export interface ExperimentConfiguration {
  id: string; // Draft or version id
  experimentId: string;
  trials: Trial[];
  logic: LogicRule[];
  randomization: RandomizationConfig;
  qualityRules: QualityRule[];
}

export interface LogicRule {
  id: string;
  trialId: string;
  condition: {
    type: 'response_equals' | 'accuracy_equals' | 'timeout';
    value: any;
  };
  action: {
    type: 'go_to_trial' | 'show_feedback' | 'end_experiment';
    targetId?: string;
  };
}

export interface RandomizationConfig {
  type: 'none' | 'block' | 'full';
  preventImmediateRepetition: boolean;
  blocks?: string[][]; // Array of trial IDs grouped into blocks
}

export interface QualityRule {
  id: string;
  type: 'min_rt' | 'max_rt' | 'identical_responses' | 'attention_check_failed';
  threshold: number;
  action: 'flag' | 'exclude';
}

export interface TrialResponse {
  trialId: string;
  response: any;
  reactionTimeMs: number;
  trialDurationMs: number;
  isCorrect?: boolean;
  timestamp: string;
}

export interface ParticipantSession {
  id: string;
  experimentId: string;
  participantId: string;
  version: number;
  status: 'in_progress' | 'completed' | 'abandoned' | 'excluded';
  responses: TrialResponse[];
  qualityFlags: QualityFlag[];
  startedAt: string;
  completedAt?: string;
}

export interface QualityFlag {
  id: string;
  sessionId: string;
  issueType: string;
  description: string;
  affectedTrials?: string[];
  evidence: string;
  timestamp: string;
}

export interface ParticipantRating {
  participantId: string;
  rating: number; // 0-100
  history: RatingEvent[];
}

export interface RatingEvent {
  id: string;
  delta: number;
  reason: string;
  timestamp: string;
}

export interface ExportJob {
  id: string;
  experimentId: string;
  format: 'csv' | 'excel' | 'json';
  status: 'queued' | 'processing' | 'ready' | 'failed';
  downloadUrl?: string;
  createdAt: string;
}
