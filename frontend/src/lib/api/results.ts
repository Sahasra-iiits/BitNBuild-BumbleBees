// ==============================================================================
// CogniScale Frontend — Results API
// ==============================================================================

import { api } from './client';
import { ExperimentResultSummary, RawTrialResponse, PaginatedResponse } from '../types/api';

const MOCK_RESULTS: ExperimentResultSummary = {
  experimentId: 'exp-mock-1',
  totalSessions: 124,
  completedSessions: 117,
  excludedSessions: 7,
  computedAt: new Date().toISOString(),
  aggregates: [
    { condition: 'Condition A', n: 58, meanRt: 742, medianRt: 728, stdRt: 98, accuracy: 0.84, errorRate: 0.16 },
    { condition: 'Condition B', n: 59, meanRt: 691, medianRt: 675, stdRt: 87, accuracy: 0.89, errorRate: 0.11 },
  ],
};

export const resultsApi = {
  getAggregate: async (experimentId: string, versionId?: string): Promise<ExperimentResultSummary> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 500));
      return MOCK_RESULTS;
    }
    const query = versionId ? `?versionId=${versionId}` : '';
    return api.get<ExperimentResultSummary>(`/results/experiments/${experimentId}${query}`);
  },

  listParticipants: async (experimentId: string, params?: { page?: number; limit?: number; status?: string }) => {
    if (api.useMock) {
      return {
        data: Array.from({ length: 10 }).map((_, i) => ({
          pseudonymousRef: `pseudo-${i + 100}`,
          status: i === 0 ? 'EXCLUDED' : 'COMPLETED',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          qualityStatus: 'CLEAN',
        })),
        pagination: { page: 1, limit: 20, total: 10, totalPages: 1, hasNext: false, hasPrev: false },
      };
    }
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get(`/results/experiments/${experimentId}/participants${query ? `?${query}` : ''}`);
  },

  getRawData: async (experimentId: string, params?: { includeExcluded?: boolean; limit?: number; offset?: number }) => {
    if (api.useMock) {
      const rows: RawTrialResponse[] = Array.from({ length: 15 }).map((_, i) => ({
        id: `resp-${i}`,
        sessionId: `sess-${Math.floor(i / 3)}`,
        trialId: `trial-mock-${(i % 3) + 1}`,
        eventId: `evt-${i}`,
        trialSequence: i % 3,
        condition: i % 2 === 0 ? 'Condition A' : 'Condition B',
        reactionTimeMs: Math.floor(400 + Math.random() * 500),
        response: { key: i % 4 === 0 ? 'y' : 'n' },
        correct: i % 5 !== 0,
        timeout: false,
        excluded: i === 12,
        exclusionReason: i === 12 ? 'Extremely fast responses detected' : undefined,
        createdAt: new Date().toISOString(),
      }));
      return { data: rows, count: rows.length };
    }
    const query = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [k, v]) => (v !== undefined ? { ...acc, [k]: String(v) } : acc), {})
    ).toString();
    return api.get<{ data: RawTrialResponse[]; count: number }>(
      `/results/experiments/${experimentId}/data${query ? `?${query}` : ''}`
    );
  },
};
