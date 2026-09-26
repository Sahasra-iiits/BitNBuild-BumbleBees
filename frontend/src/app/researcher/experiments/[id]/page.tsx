"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { experimentsApi, versionsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader, useExperiment } from '@/components/researcher/ExperimentHeader';

export default function ExperimentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: experiment, isLoading } = useExperiment(id);
  const { data: versions } = useQuery({ queryKey: ['versions', id], queryFn: () => versionsApi.list(id), enabled: !!experiment });
  const [error, setError] = useState<string | null>(null);

  const lifecycle = useMutation({
    mutationFn: async (action: 'pause' | 'resume' | 'close' | 'archive' | 'delete') => {
      if (action === 'delete') return experimentsApi.delete(id);
      return experimentsApi[action](id);
    },
    onSuccess: (_data, action) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['experiment', id] });
      void queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
      if (action === 'delete') router.push('/researcher/experiments');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const confirmAndRun = (action: 'pause' | 'resume' | 'close' | 'archive' | 'delete', message?: string) => {
    if (message && !window.confirm(message)) return;
    lifecycle.mutate(action);
  };

  const participantLink = typeof window !== 'undefined' ? `${window.location.origin}/participant/experiments/${id}/run` : '';

  return (
    <div className="max-w-5xl mx-auto">
      <ExperimentHeader id={id} />
      {isLoading || !experiment ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          {experiment.description && <p className="text-slate-600">{experiment.description}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Sessions', experiment._count?.sessions ?? 0],
              ['Versions', experiment.versions.length],
              ['Reward', `${experiment.rewardPoints} pts`],
              ['Visibility', experiment.visibility === 'PUBLIC' ? 'Public' : 'Private link'],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border rounded-xl p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>

          {(experiment.status === 'PUBLISHED' || experiment.status === 'PAUSED') && (
            <div className="bg-white border rounded-xl p-5 space-y-2">
              <h2 className="font-semibold">Participant link</h2>
              <div className="flex flex-wrap gap-2">
                <code className="flex-1 min-w-0 truncate p-2 bg-slate-50 rounded border text-sm">{participantLink}</code>
                <button type="button" onClick={() => void navigator.clipboard.writeText(participantLink)} className="px-3 py-2 border rounded text-sm hover:bg-slate-50">
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold">Status</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              {experiment.status === 'DRAFT' && (
                <Link href={`/researcher/experiments/${id}/publish`} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium">
                  Review & publish
                </Link>
              )}
              {experiment.status === 'PUBLISHED' && (
                <button type="button" disabled={lifecycle.isPending} onClick={() => confirmAndRun('pause')} className="px-4 py-2 rounded-md border text-sm">
                  Pause (stop accepting participants)
                </button>
              )}
              {experiment.status === 'PAUSED' && (
                <button type="button" disabled={lifecycle.isPending} onClick={() => confirmAndRun('resume')} className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm">
                  Resume current version
                </button>
              )}
              {(experiment.status === 'PUBLISHED' || experiment.status === 'PAUSED') && (
                <button type="button" disabled={lifecycle.isPending} onClick={() => confirmAndRun('close', 'Close the experiment permanently? Participants will no longer be able to take part.')} className="px-4 py-2 rounded-md border border-red-300 text-red-700 text-sm">
                  Close
                </button>
              )}
              {experiment.status === 'CLOSED' && (
                <button type="button" disabled={lifecycle.isPending} onClick={() => confirmAndRun('archive', 'Archive this experiment? It becomes read-only.')} className="px-4 py-2 rounded-md border text-sm">
                  Archive
                </button>
              )}
              {experiment.status === 'DRAFT' && experiment.versions.length === 0 && (experiment._count?.sessions ?? 0) === 0 && (
                <button type="button" disabled={lifecycle.isPending} onClick={() => confirmAndRun('delete', 'Delete this draft experiment permanently?')} className="px-4 py-2 rounded-md border border-red-300 text-red-700 text-sm">
                  Delete draft
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <h2 className="font-semibold px-5 py-3 border-b">Published versions</h2>
            {!versions || versions.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Not published yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-5 py-2">Version</th>
                    <th className="px-5 py-2">Published</th>
                    <th className="px-5 py-2 text-right">Trials</th>
                    <th className="px-5 py-2 text-right">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-5 py-2 font-medium">v{v.versionNumber}</td>
                      <td className="px-5 py-2">{v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}</td>
                      <td className="px-5 py-2 text-right">{v.trialCount}</td>
                      <td className="px-5 py-2 text-right">{v._count.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="px-5 py-3 text-xs text-slate-500 border-t">
              Published versions never change. Editing in the builder changes the draft only; participants keep the version they started until you publish an update.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
