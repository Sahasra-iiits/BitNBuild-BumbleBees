// ==============================================================================
// CogniScale Frontend — Experiments API
// ==============================================================================

import { api } from './client';
import {
  Experiment,
  CreateExperimentRequest,
  UpdateExperimentRequest,
  ExperimentVersion,
  CreateVersionRequest,
  EligibilityResult,
  PaginatedResponse,
} from '../types/api';

// Mock data (used when NEXT_PUBLIC_USE_MOCK=true)
const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-mock-1',
    researcherId: 'res-mock-1',
    title: 'Visual Working Memory Task',
    description: 'A study on the capacity of visual working memory using complex geometric shapes.',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    rewardPoints: 10,
    attemptPolicy: 'ALLOW_ONE_ATTEMPT',
    maxAttempts: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { sessions: 124 },
  },
  {
    id: 'exp-mock-2',
    researcherId: 'res-mock-1',
    title: 'Lexical Decision Task',
    description: 'Word vs Non-word reaction time experiment.',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    rewardPoints: 5,
    attemptPolicy: 'ALLOW_MULTIPLE_ATTEMPTS',
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { sessions: 0 },
  },
  {
    id: 'exp-mock-3',
    researcherId: 'res-mock-1',
    title: 'Attentional Blink Study',
    description: 'Study of the attentional blink phenomenon using rapid serial visual presentation.',
    status: 'PAUSED',
    visibility: 'PUBLIC',
    rewardPoints: 8,
    attemptPolicy: 'ALLOW_ONE_ATTEMPT',
    maxAttempts: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { sessions: 57 },
  },
];

const MOCK_VERSION: ExperimentVersion = {
  id: 'ver-mock-1',
  experimentId: 'exp-mock-1',
  versionNumber: 1,
  configHash: 'abc123',
  configSnapshot: { trials: [], logicRules: [], randomization: [] },
  createdAt: new Date().toISOString(),
  trials: [
    {
      id: 'trial-mock-1',
      versionId: 'ver-mock-1',
      sequenceOrder: 0,
      trialType: 'INSTRUCTION',
      name: 'Welcome',
      configuration: { text: 'Welcome to the Visual Working Memory Task. Press SPACE to begin.' },
      elements: [
        { id: 'el-1', trialId: 'trial-mock-1', elementType: 'TEXT', configuration: { text: 'Welcome to the Visual Working Memory Task. Press SPACE to begin.' }, sequenceOrder: 0 },
      ],
    },
    {
      id: 'trial-mock-2',
      versionId: 'ver-mock-1',
      sequenceOrder: 1,
      trialType: 'FIXATION',
      name: 'Fixation Cross',
      configuration: {},
      durationMs: 500,
      elements: [],
    },
    {
      id: 'trial-mock-3',
      versionId: 'ver-mock-1',
      sequenceOrder: 2,
      trialType: 'STIMULUS',
      name: 'Target Display',
      configuration: {},
      durationMs: 1000,
      timeoutMs: 2000,
      elements: [
        { id: 'el-2', trialId: 'trial-mock-3', elementType: 'IMAGE', configuration: { src: 'https://placehold.co/400x400/png', alt: 'Target stimulus' }, sequenceOrder: 0 },
        { id: 'el-3', trialId: 'trial-mock-3', elementType: 'TEXT', configuration: { text: 'Did you see a red square? Press Y or N.' }, sequenceOrder: 1 },
        { id: 'el-4', trialId: 'trial-mock-3', elementType: 'KEYBOARD_INPUT', configuration: { allowedKeys: ['y', 'n'], correctResponse: 'y' }, sequenceOrder: 2 },
      ],
    },
  ],
  logicRules: [],
  randomization: [],
};

// =============================================================================
// Researcher Experiments API
// =============================================================================

export const experimentsApi = {
  // List researcher's own experiments (paginated)
  list: async (params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<Experiment>> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 400));
      return {
        data: MOCK_EXPERIMENTS,
        pagination: { page: 1, limit: 20, total: MOCK_EXPERIMENTS.length, totalPages: 1, hasNext: false, hasPrev: false },
      };
    }
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<PaginatedResponse<Experiment>>(`/experiments${query ? `?${query}` : ''}`);
  },

  // Get single experiment
  get: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 300));
      const exp = MOCK_EXPERIMENTS.find(e => e.id === id);
      if (!exp) throw new Error('Experiment not found');
      return exp;
    }
    return api.get<Experiment>(`/experiments/${id}`);
  },

  // Create experiment
  create: async (data: CreateExperimentRequest): Promise<Experiment> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 600));
      const newExp: Experiment = {
        id: `exp-mock-${Date.now()}`,
        researcherId: 'res-mock-1',
        title: data.title,
        description: data.description,
        status: 'DRAFT',
        visibility: data.visibility || 'PRIVATE',
        rewardPoints: data.rewardPoints || 0,
        attemptPolicy: data.attemptPolicy || 'ALLOW_ONE_ATTEMPT',
        maxAttempts: data.maxAttempts || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_EXPERIMENTS.push(newExp);
      return newExp;
    }
    return api.post<Experiment>('/experiments', data);
  },

  // Update experiment (draft only)
  update: async (id: string, data: UpdateExperimentRequest): Promise<Experiment> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 400));
      const idx = MOCK_EXPERIMENTS.findIndex(e => e.id === id);
      if (idx === -1) throw new Error('Not found');
      MOCK_EXPERIMENTS[idx] = { ...MOCK_EXPERIMENTS[idx], ...data, updatedAt: new Date().toISOString() };
      return MOCK_EXPERIMENTS[idx];
    }
    return api.patch<Experiment>(`/experiments/${id}`, data);
  },

  // Delete experiment (draft only)
  delete: async (id: string): Promise<void> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 300));
      return;
    }
    return api.delete(`/experiments/${id}`);
  },

  // Lifecycle: Publish
  publish: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      const idx = MOCK_EXPERIMENTS.findIndex(e => e.id === id);
      if (idx !== -1) MOCK_EXPERIMENTS[idx].status = 'PUBLISHED';
      return MOCK_EXPERIMENTS[idx];
    }
    return api.post<Experiment>(`/experiments/${id}/publish`);
  },

  // Lifecycle: Pause
  pause: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      const idx = MOCK_EXPERIMENTS.findIndex(e => e.id === id);
      if (idx !== -1) MOCK_EXPERIMENTS[idx].status = 'PAUSED';
      return MOCK_EXPERIMENTS[idx];
    }
    return api.post<Experiment>(`/experiments/${id}/pause`);
  },

  // Lifecycle: Close
  close: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      const idx = MOCK_EXPERIMENTS.findIndex(e => e.id === id);
      if (idx !== -1) MOCK_EXPERIMENTS[idx].status = 'CLOSED';
      return MOCK_EXPERIMENTS[idx];
    }
    return api.post<Experiment>(`/experiments/${id}/close`);
  },

  // Lifecycle: Archive
  archive: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      const idx = MOCK_EXPERIMENTS.findIndex(e => e.id === id);
      if (idx !== -1) MOCK_EXPERIMENTS[idx].status = 'ARCHIVED';
      return MOCK_EXPERIMENTS[idx];
    }
    return api.post<Experiment>(`/experiments/${id}/archive`);
  },
};

// =============================================================================
// Public Experiments API (participant discovery)
// =============================================================================

export const publicExperimentsApi = {
  list: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Experiment>> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 400));
      const pub = MOCK_EXPERIMENTS.filter(e => e.visibility === 'PUBLIC' && e.status === 'PUBLISHED');
      return {
        data: pub,
        pagination: { page: 1, limit: 20, total: pub.length, totalPages: 1, hasNext: false, hasPrev: false },
      };
    }
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<PaginatedResponse<Experiment>>(`/experiments/public${query ? `?${query}` : ''}`);
  },

  get: async (id: string): Promise<Experiment> => {
    if (api.useMock) {
      const exp = MOCK_EXPERIMENTS.find(e => e.id === id);
      if (!exp) throw new Error('Not found');
      return exp;
    }
    return api.get<Experiment>(`/experiments/${id}`);
  },

  checkEligibility: async (id: string): Promise<EligibilityResult> => {
    if (api.useMock) {
      return { eligible: true };
    }
    return api.get<EligibilityResult>(`/experiments/${id}/eligibility`);
  },
};

// =============================================================================
// Version API
// =============================================================================

export const versionsApi = {
  list: async (experimentId: string): Promise<ExperimentVersion[]> => {
    if (api.useMock) {
      return [MOCK_VERSION];
    }
    return api.get<ExperimentVersion[]>(`/experiments/${experimentId}/versions`);
  },

  create: async (experimentId: string, data: CreateVersionRequest): Promise<ExperimentVersion> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 500));
      return { ...MOCK_VERSION, id: `ver-mock-${Date.now()}`, experimentId };
    }
    return api.post<ExperimentVersion>(`/experiments/${experimentId}/versions`, data);
  },

  get: async (experimentId: string, versionId: string): Promise<ExperimentVersion> => {
    if (api.useMock) {
      return MOCK_VERSION;
    }
    return api.get<ExperimentVersion>(`/experiments/${experimentId}/versions/${versionId}`);
  },
};
