"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@/lib/api/sessions';
import { errorMessage } from '@/lib/api/client';

const STATUS_LABEL: Record<string, string> = {
  STARTED: 'Started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  ABANDONED: 'Abandoned',
  EXCLUDED: 'Excluded by researcher',
};

export default function HistoryPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-sessions'], queryFn: () => sessionsApi.listMine(), refetchOnMount: 'always' });
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-bold tracking-tight">Your participation history</h1>
      {isLoading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{errorMessage(error)}</p>}
      {data && data.length === 0 && <div className="bg-white border rounded-xl p-8 text-center text-slate-500">You have not taken part in any experiments yet.</div>}
      {data && data.length > 0 && (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2">Experiment</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2 text-right">Reward</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{s.experiment.title}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[s.status] ?? s.status}</td>
                  <td className="px-4 py-2">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{s.rewardPoints > 0 ? `+${s.rewardPoints}` : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {(s.status === 'STARTED' || s.status === 'IN_PROGRESS') && s.experiment.status === 'PUBLISHED' && (
                      <Link href={`/participant/experiments/${s.experimentId}/run`} className="text-blue-700 hover:underline">
                        Continue
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
