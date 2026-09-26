import { api } from './client';
import type { ExperimentDefinition } from '@/shared/experiment';
import type {
  CreateExperimentRequest,
  DraftResponse,
  DraftValidation,
  EligibilityResult,
  Experiment,
  ExperimentDetail,
  PaginatedResponse,
  PublicExperiment,
  PublishResponse,
  SaveDraftResponse,
  UpdateExperimentRequest,
  VersionDetail,
  VersionListItem,
} from '../types/api';

export const experimentsApi = {
  list: (params: { page?: number; limit?: number; status?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return api.get<PaginatedResponse<Experiment>>(`/experiments${query ? `?${query}` : ''}`);
  },
  get: (id: string) => api.get<ExperimentDetail>(`/experiments/${id}`),
  create: (data: CreateExperimentRequest) => api.post<Experiment>('/experiments', data),
  update: (id: string, data: UpdateExperimentRequest) => api.patch<Experiment>(`/experiments/${id}`, data),
  delete: (id: string) => api.delete<void>(`/experiments/${id}`),

  getDraft: (id: string) => api.get<DraftResponse>(`/experiments/${id}/draft`),
  saveDraft: (id: string, definition: ExperimentDefinition, baseRevision: number, options?: { keepalive?: boolean }) =>
    api.put<SaveDraftResponse>(`/experiments/${id}/draft`, { definition, baseRevision }, options),
  validateDraft: (id: string) => api.get<DraftValidation>(`/experiments/${id}/draft/validation`),

  publish: (id: string) => api.post<PublishResponse>(`/experiments/${id}/publish`),
  pause: (id: string) => api.post<Experiment>(`/experiments/${id}/pause`),
  resume: (id: string) => api.post<Experiment>(`/experiments/${id}/resume`),
  close: (id: string) => api.post<Experiment>(`/experiments/${id}/close`),
  archive: (id: string) => api.post<Experiment>(`/experiments/${id}/archive`),
};

export const versionsApi = {
  list: (experimentId: string) => api.get<VersionListItem[]>(`/experiments/${experimentId}/versions`),
  get: (experimentId: string, versionId: string) => api.get<VersionDetail>(`/experiments/${experimentId}/versions/${versionId}`),
};

export const publicExperimentsApi = {
  list: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return api.get<PaginatedResponse<PublicExperiment>>(`/experiments/public${query ? `?${query}` : ''}`);
  },
  get: (id: string) => api.get<PublicExperiment>(`/experiments/${id}`),
  checkEligibility: (id: string) => api.get<EligibilityResult>(`/experiments/${id}/eligibility`),
};
