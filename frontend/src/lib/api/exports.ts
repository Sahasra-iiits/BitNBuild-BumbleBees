import { api, apiFetch } from './client';
import type { ExportFormat, ExportJob } from '../types/api';

export const exportsApi = {
  create: (data: { experimentId: string; format: ExportFormat; filters?: { includeExcluded?: boolean; versionId?: string }; idempotencyKey?: string }) =>
    api.post<ExportJob>('/exports', data),
  get: (id: string) => api.get<ExportJob>(`/exports/${id}`),
  list: (experimentId: string) => api.get<ExportJob[]>(`/exports?experimentId=${experimentId}`),

  /** Downloads with the user's credentials and hands the file to the browser. */
  download: async (job: ExportJob): Promise<void> => {
    const res = await apiFetch(`/exports/${job.id}/download`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = job.fileName ?? `export.${job.format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Give the browser a moment to start the download before releasing the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  },
};
