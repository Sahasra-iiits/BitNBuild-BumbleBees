"use client";
import { useQuery } from '@tanstack/react-query';
import { qualityApi } from '@/lib/api/quality';
import { errorMessage } from '@/lib/api/client';

const REASON_LABEL: Record<string, string> = {
  EXPERIMENT_COMPLETION: 'Completed an experiment',
  EXTREMELY_FAST_RESPONSE: 'Many extremely fast responses',
  REPEATED_IDENTICAL_RESPONSES: 'Many identical responses in a row',
  SKIPPED_REQUIRED_QUESTIONS: 'Required questions left unanswered',
  RESEARCHER_QUALITY_FLAG: 'Confirmed quality report from a researcher',
  ADMIN_ADJUSTMENT: 'Administrator adjustment',
};

export default function RatingPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-rating'], queryFn: () => qualityApi.getMyRating(), refetchOnMount: 'always' });
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-bold tracking-tight">Your participant rating</h1>
      {isLoading && <p className="text-slate-500">Loading…</p>}
      {error && <p className="text-red-600">{errorMessage(error)}</p>}
      {data && (
        <>
          <div className="bg-white border rounded-xl p-6">
            <div className="text-5xl font-black text-blue-600">{Math.round(data.currentRating)}</div>
            <p className="text-sm text-slate-600 mt-2">
              Everyone starts at {data.bounds.default}; the scale runs from {data.bounds.min} to {data.bounds.max}. Completing studies carefully raises it by the study&apos;s reward. Automatic quality checks and confirmed researcher reports lower it.
              Some studies require a minimum rating.
            </p>
          </div>
          <div className="bg-white border rounded-xl overflow-x-auto">
            <h2 className="font-semibold px-5 py-3 border-b">Every change and why</h2>
            {data.history.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No changes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Reason</th>
                    <th className="px-4 py-2">Experiment</th>
                    <th className="px-4 py-2 text-right">Change</th>
                    <th className="px-4 py-2 text-right">New rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-4 py-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{REASON_LABEL[h.reason] ?? h.reason}</td>
                      <td className="px-4 py-2">{h.experimentTitle ?? '—'}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${h.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {h.delta > 0 ? '+' : ''}
                        {Math.round(h.delta)}
                      </td>
                      <td className="px-4 py-2 text-right">{Math.round(h.newRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
