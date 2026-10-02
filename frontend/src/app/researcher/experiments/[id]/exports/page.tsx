"use client";
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Braces, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { exportsApi } from '@/lib/api/exports';
import { versionsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader } from '@/components/researcher/ExperimentHeader';
import type { ExportFormat, ExportJob, ExportLayout } from '@/lib/types/api';

const FORMATS: Array<{ format: ExportFormat; icon: React.ComponentType<{ className?: string }>; title: string; note: Record<ExportLayout, string> }> = [
  {
    format: 'CSV',
    icon: FileText,
    title: 'CSV',
    note: { long: 'Tidy long format, one row per response — ready for R, Python, SPSS.', dataset: 'One row per participant, one column per question.' },
  },
  {
    format: 'XLSX',
    icon: FileSpreadsheet,
    title: 'Excel',
    note: { long: 'Same rows as CSV plus a codebook sheet describing every column.', dataset: 'Form responses sheet with filters, plus an “About this file” sheet.' },
  },
  { format: 'JSON', icon: Braces, title: 'JSON', note: { long: 'Nested sessions → trials → responses.', dataset: 'Rows keyed by question heading.' } },
];

const LAYOUTS: Array<{ layout: ExportLayout; title: string; note: string }> = [
  { layout: 'long', title: 'Response log', note: 'One row per response with reaction times, scoring and timestamps.' },
  { layout: 'dataset', title: 'Dataset (like a form response sheet)', note: 'One row per completed participant: timestamp, participant id and type, then one column per question.' },
];

const STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  READY: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-800',
};

export default function ExportsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [versionId, setVersionId] = useState('');
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [layout, setLayout] = useState<ExportLayout>('long');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const versions = useQuery({ queryKey: ['versions', id], queryFn: () => versionsApi.list(id) });
  const jobs = useQuery({
    queryKey: ['exports', id],
    queryFn: () => exportsApi.list(id),
    refetchInterval: (q) => ((q.state.data ?? []).some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING') ? 2000 : false),
  });

  const create = useMutation({
    mutationFn: (format: ExportFormat) => exportsApi.create({ experimentId: id, format, filters: { includeExcluded, versionId: versionId || undefined, layout } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exports', id] }),
  });

  const download = async (job: ExportJob) => {
    setDownloadError(null);
    setDownloading(job.id);
    try {
      await exportsApi.download(job);
    } catch (e) {
      setDownloadError(errorMessage(e, 'Download failed.'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <ExperimentHeader id={id} />
      <section className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">New export</h2>
        <div role="radiogroup" aria-label="Export layout" className="grid sm:grid-cols-2 gap-3">
          {LAYOUTS.map((l) => (
            <label key={l.layout} className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer ${layout === l.layout ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="layout" className="mt-1 accent-blue-600" checked={layout === l.layout} onChange={() => setLayout(l.layout)} />
              <span>
                <span className="block font-medium text-sm">{l.title}</span>
                <span className="block text-xs text-slate-500">{l.note}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label>
            Version{' '}
            <select className="ml-1 border rounded-md px-2 py-1" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              <option value="">All versions</option>
              {versions.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-blue-600" checked={includeExcluded} onChange={(e) => setIncludeExcluded(e.target.checked)} />
            Include excluded data (flagged in the file)
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {FORMATS.map(({ format, icon: Icon, title, note }) => (
            <button
              key={format}
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate(format)}
              className="text-left p-4 border-2 rounded-xl hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
            >
              <Icon className="w-6 h-6 text-slate-700 mb-2" />
              <div className="font-semibold">{title}</div>
              <div className="text-xs text-slate-500">{note[layout]}</div>
            </button>
          ))}
        </div>
        {create.isError && <p className="text-sm text-red-600">{errorMessage(create.error, 'The export could not be created.')}</p>}
      </section>

      <section className="bg-white border rounded-xl overflow-hidden">
        <h2 className="font-semibold px-5 py-3 border-b">Exports</h2>
        {downloadError && <p className="px-5 py-2 text-sm text-red-600">{downloadError}</p>}
        {jobs.isLoading && <p className="px-5 py-4 text-slate-500 text-sm">Loading…</p>}
        {jobs.error && <p className="px-5 py-4 text-red-600 text-sm">{errorMessage(jobs.error)}</p>}
        {jobs.data?.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No exports yet.</p>}
        <ul className="divide-y">
          {jobs.data?.map((job) => (
            <li key={job.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{job.fileName ?? `${job.format} export`}</div>
                <div className="text-xs text-slate-500">
                  {job.filters?.layout === 'dataset' ? 'Dataset · ' : 'Response log · '}
                  {new Date(job.createdAt).toLocaleString()}
                  {job.filters?.versionId ? ` · version filter` : ' · all versions'}
                  {job.filters?.includeExcluded ? ' · includes excluded' : ''}
                  {job.expiresAt ? ` · expires ${new Date(job.expiresAt).toLocaleString()}` : ''}
                </div>
                {job.status === 'FAILED' && <div className="text-xs text-red-600">{job.errorMessage}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[job.status]}`}>{job.status}</span>
                {job.downloadable && (
                  <button type="button" disabled={downloading === job.id} onClick={() => void download(job)} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline disabled:opacity-50">
                    {downloading === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
