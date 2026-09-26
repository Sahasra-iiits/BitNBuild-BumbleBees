// ==============================================================================
// CogniScale Frontend — Quality & Ratings API
// ==============================================================================

import { api } from './client';
import {
  QualityFlag,
  CreateQualityFlagRequest,
  ReviewFlagRequest,
  ParticipantRating,
} from '../types/api';

const MOCK_FLAGS: QualityFlag[] = [
  {
    id: 'flag-mock-1',
    participantId: 'part-mock-99',
    experimentId: 'exp-mock-1',
    sessionId: 'sess-mock-99',
    researcherId: 'res-mock-1',
    reason: 'Suspicious response pattern',
    description: 'Trials 12–19 show identical responses regardless of stimulus.',
    affectedTrials: ['trial-mock-3'],
    evidence: { trialRange: '12-19', pattern: 'identical_y_responses' },
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  },
];

const MOCK_RATING: ParticipantRating = {
  currentRating: 85,
  totalRewardPoints: 120,
  completedSessionsCount: 12,
  history: [
    { id: 'ev-1', oldRating: 100, delta: -5, newRating: 95, reason: 'RESEARCHER_QUALITY_FLAG', source: 'RESEARCHER', createdAt: new Date(Date.now() - 100000).toISOString() },
    { id: 'ev-2', oldRating: 95, delta: 10, newRating: 105, reason: 'EXPERIMENT_COMPLETION', source: 'SYSTEM', createdAt: new Date(Date.now() - 80000).toISOString() },
    { id: 'ev-3', oldRating: 105, delta: -20, newRating: 85, reason: 'FAILED_ATTENTION_CHECK', source: 'SYSTEM', createdAt: new Date(Date.now() - 50000).toISOString() },
  ],
};

export const qualityApi = {
  // Researcher: Create a quality flag
  createFlag: async (data: CreateQualityFlagRequest): Promise<QualityFlag> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 400));
      const flag: QualityFlag = {
        id: `flag-mock-${Date.now()}`,
        ...data,
        researcherId: 'res-mock-1',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      };
      MOCK_FLAGS.push(flag);
      return flag;
    }
    return api.post<QualityFlag>('/quality/flags', data);
  },

  // Researcher: Review a quality flag
  reviewFlag: async (flagId: string, data: ReviewFlagRequest): Promise<QualityFlag> => {
    if (api.useMock) {
      const idx = MOCK_FLAGS.findIndex(f => f.id === flagId);
      if (idx !== -1) {
        MOCK_FLAGS[idx].status = data.status;
        MOCK_FLAGS[idx].reviewedAt = new Date().toISOString();
      }
      return MOCK_FLAGS[idx];
    }
    return api.post<QualityFlag>(`/quality/flags/${flagId}/review`, data);
  },

  // Researcher: List flags for an experiment
  listFlags: async (experimentId: string): Promise<{ data: QualityFlag[]; pagination: unknown }> => {
    if (api.useMock) {
      return { data: MOCK_FLAGS, pagination: { page: 1, total: MOCK_FLAGS.length } };
    }
    return api.get(`/quality/flags/experiments/${experimentId}`);
  },

  // Participant: Get own rating
  getMyRating: async (): Promise<ParticipantRating> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_RATING;
    }
    return api.get<ParticipantRating>('/quality/participants/me/rating');
  },
};
