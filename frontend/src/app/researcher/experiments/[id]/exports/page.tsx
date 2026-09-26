"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { experimentsApi } from '@/lib/api/experiments';
import { exportsApi } from '@/lib/api/exports';
import { ExportFormat } from '@/lib/types/api';
import { useState } from 'react';
import { Download, RefreshCw, Clock, AlertCircle, CheckCircle, FileText, FileSpreadsheet, Braces } from 'lucide-react';

export default function ExportsPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [requestedFormat, setRequestedFormat] = useState<ExportFormat | null>(null);

  const { data: experiment } = useQuery({
    queryKey: ['experiment', id],
    queryFn: () => experimentsApi.get(id),
  });

  const { data: exports = [], refetch } = useQuery({
    queryKey: ['exports', id],
    queryFn: () => exportsApi.list(id),
    refetchInterval: (data) => {
      const hasActive = (data?.state?.data || []).some(
        (j: any) => j.status === 'QUEUED' || j.status === 'PROCESSING'
      );
      return hasActive ? 3000 : false; // Poll every 3s if jobs are active
    },
  });

  const createExport = useMutation({
    mutationFn: (format: ExportFormat) => exportsApi.create({
      experimentId: id,
      format,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports', id] });
      setRequestedFormat(null);
    },
  });

  const formatIcons = {
    CSV: FileText,
    XLSX: FileSpreadsheet,
    JSON: Braces,
  };

  const statusColors: Record<string, string> = {
    QUEUED: 'bg-slate-100 text-slate-600',
    PROCESSING: 'bg-blue-100 text-blue-700',
    READY: 'bg-emerald-100 text-emerald-700',
    FAILED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">{experiment?.title || id}</span>
          <span>/</span>
          <span>Exports</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Exports</h1>
            <p className="text-slate-500 mt-1">Request exports. Large datasets are processed asynchronously.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-slate-600 border px-3 py-2 rounded-lg hover:bg-slate-50 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Request New Export */}
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-5 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-800">Request New Export</h2>
          <p className="text-sm text-slate-500 mt-0.5">Exports include all non-excluded trial responses.</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['CSV', 'XLSX', 'JSON'] as ExportFormat[]).map(format => {
            const Icon = formatIcons[format];
            return (
              <button
                key={format}
                disabled={createExport.isPending}
                onClick={() => createExport.mutate(format)}
                className={`flex flex-col items-center gap-3 p-6 border-2 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all font-medium ${createExport.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className="w-8 h-8 text-slate-700" />
                <span className="text-lg">{format}</span>
                <span className="text-xs text-slate-400 text-center">
                  {format === 'CSV' ? 'Comma-separated values' : format === 'XLSX' ? 'Excel workbook' : 'JSON array format'}
                </span>
              </button>
            );
          })}
        </div>
        {createExport.isError && (
          <div className="px-5 pb-4 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Failed to create export. Please try again.
          </div>
        )}
      </div>

      {/* Export History */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-800">Export History</h2>
        </div>
        {exports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No exports yet. Request one above.</div>
        ) : (
          <div className="divide-y">
            {exports.map((job: any) => {
              const Icon = formatIcons[job.format as ExportFormat] || FileText;
              const isProcessing = job.status === 'QUEUED' || job.status === 'PROCESSING';
              return (
                <div key={job.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="font-medium text-sm">{job.fileName || `${job.format} Export`}</div>
                      <div className="text-xs text-slate-400">{new Date(job.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isProcessing && <Clock className="w-4 h-4 text-blue-500 animate-pulse" />}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[job.status] || 'bg-slate-100'}`}>
                      {job.status}
                    </span>
                    {job.status === 'READY' && job.downloadUrl && (
                      <a
                        href={job.downloadUrl}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        download
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                    )}
                    {job.status === 'FAILED' && (
                      <span className="text-xs text-red-500">{job.errorMessage}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
