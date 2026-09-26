import { api } from './client';
import type { PaginatedResponse, RawDataResponse, ResultsResponse, SessionListItem } from '../types/api';

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as Array<[string, string | number | boolean]>;
  const query = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return query ? `?${query}` : '';
}

export const resultsApi = {
  getAggregate: (experimentId: string, versionId?: string) =>
    api.get<ResultsResponse>(`/results/experiments/${experimentId}${qs({ versionId })}`),
  listSessions: (experimentId: string, params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<PaginatedResponse<SessionListItem>>(`/results/experiments/${experimentId}/participants${qs(params)}`),
  getRawData: (experimentId: string, params: { includeExcluded?: boolean; versionId?: string; limit?: number; offset?: number } = {}) =>
    api.get<RawDataResponse>(`/results/experiments/${experimentId}/data${qs(params)}`),
};
