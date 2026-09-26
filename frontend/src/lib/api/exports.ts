// ==============================================================================
// CogniScale Frontend — Exports API
// ==============================================================================

import { api } from './client';
import { ExportJob, CreateExportRequest, ExportFormat, ExportStatus } from '../types/api';

let MOCK_EXPORTS: ExportJob[] = [
  {
    id: 'export-mock-1',
    researcherId: 'res-mock-1',
    experimentId: 'exp-mock-1',
    format: 'CSV',
    status: 'READY',
    fileName: 'vwm_task_export.csv',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86000000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 23).toISOString(),
    downloadUrl: '#', // Would be a signed S3 URL in production
  },
  {
    id: 'export-mock-2',
    researcherId: 'res-mock-1',
    experimentId: 'exp-mock-1',
    format: 'XLSX',
    status: 'FAILED',
    errorMessage: 'Internal processing error. Please retry.',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export const exportsApi = {
  create: async (data: CreateExportRequest): Promise<ExportJob> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 600));
      const newJob: ExportJob = {
        id: `export-mock-${Date.now()}`,
        researcherId: 'res-mock-1',
        experimentId: data.experimentId,
        format: data.format,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      };
      MOCK_EXPORTS.unshift(newJob);
      
      // Simulate async processing
      setTimeout(() => {
        const idx = MOCK_EXPORTS.findIndex(e => e.id === newJob.id);
        if (idx !== -1) MOCK_EXPORTS[idx].status = 'PROCESSING';
      }, 2000);
      setTimeout(() => {
        const idx = MOCK_EXPORTS.findIndex(e => e.id === newJob.id);
        if (idx !== -1) {
          MOCK_EXPORTS[idx].status = 'READY';
          MOCK_EXPORTS[idx].downloadUrl = '#';
          MOCK_EXPORTS[idx].completedAt = new Date().toISOString();
          MOCK_EXPORTS[idx].fileName = `export_${Date.now()}.${data.format.toLowerCase()}`;
        }
      }, 5000);

      return newJob;
    }
    return api.post<ExportJob>('/exports', data);
  },

  get: async (id: string): Promise<ExportJob> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 200));
      const job = MOCK_EXPORTS.find(e => e.id === id);
      if (!job) throw new Error('Export job not found');
      return job;
    }
    return api.get<ExportJob>(`/exports/${id}`);
  },

  list: async (experimentId: string): Promise<ExportJob[]> => {
    if (api.useMock) {
      return MOCK_EXPORTS.filter(e => e.experimentId === experimentId);
    }
    return api.get<ExportJob[]>(`/exports?experimentId=${experimentId}`);
  },
};
