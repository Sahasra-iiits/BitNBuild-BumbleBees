import { api } from './client';
import type { PaginatedResponse, ParticipantRating, QualityFlag } from '../types/api';

export const qualityApi = {
  createFlag: (data: { sessionId: string; reason: string; description: string }) => api.post<QualityFlag>('/quality/flags', data),
  reviewFlag: (flagId: string, data: { status: 'CONFIRMED' | 'DISMISSED'; ratingPenalty?: number; note?: string }) =>
    api.post<QualityFlag>(`/quality/flags/${flagId}/review`, data),
  listFlags: (experimentId: string, status?: string) =>
    api.get<PaginatedResponse<QualityFlag>>(`/quality/flags/experiments/${experimentId}${status ? `?status=${status}` : ''}`),
  excludeSession: (sessionId: string, reason: string) => api.post<{ affectedResponses: number }>('/quality/exclude', { sessionId, reason }),
  getMyRating: () => api.get<ParticipantRating>('/quality/participants/me/rating'),
};
