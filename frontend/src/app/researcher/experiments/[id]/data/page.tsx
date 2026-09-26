"use client";
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api/results';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader } from '@/components/researcher/ExperimentHeader';

const PAGE_SIZE = 100;

export default function RawDataPage() {
  const { id } = useParams<{ id: string }>();
  const [offset, setOffset] = useState(0);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const query = useQuery({
    queryKey: ['raw-data', id, offset, includeExcluded],
    queryFn: () => resultsApi.getRawData(id, { limit: PAGE_SIZE, offset, includeExcluded }),
    refetchOnMount: 'always',
  });
  const data = query.data;

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      <ExperimentHeader id={id} />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={includeExcluded}
            onChange={(e) => {
              setIncludeExcluded(e.target.checked);
              setOffset(0);
            }}
          />
          Include excluded data
        </label>
        {data && (
          <span className="text-sm text-slate-500">
            Rows {data.total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
          </span>
        )}
      </div>
      {query.isLoading && <p className="text-slate-500">Loading…</p>}
      {query.error && <p className="text-red-600">{errorMessage(query.error)}</p>}
      {data && data.total === 0 && <div className="bg-white border rounded-xl p-8 text-center text-slate-500">No responses recorded yet.</div>}
      {data && data.total > 0 && (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Ver.</th>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Trial</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Ended by</th>
                <th className="px-3 py-2">Responses</th>
                <th className="px-3 py-2 text-right">RT (ms)</th>
                <th className="px-3 py-2">Correct</th>
                <th className="px-3 py-2">Excluded</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((r) => (
                <tr key={r.id} className={`border-t ${r.excluded ? 'bg-red-50/50 text-slate-500' : ''}`}>
                  <td className="px-3 py-2 font-mono text-xs">{r.participant}</td>
                  <td className="px-3 py-2">v{r.versionNumber}</td>
                  <td className="px-3 py-2">{r.trialSequence + 1}</td>
                  <td className="px-3 py-2">{r.trialName ?? r.trialKey}</td>
                  <td className="px-3 py-2">{r.condition ?? '—'}</td>
                  <td className="px-3 py-2">{r.advanceReason ?? '—'}</td>
                  <td className="px-3 py-2">
                    {r.responses.length === 0
                      ? '—'
                      : r.responses.map((e) => (
                          <div key={e.elementId}>
                            <span className="font-medium">{e.display}</span>{' '}
                            <span className="text-xs text-slate-400">
                              {e.type.toLowerCase().replace('_', ' ')}
                              {e.correct === true ? ' ✓' : e.correct === false ? ' ✗' : ''}
                            </span>
                          </div>
                        ))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.reactionTimeMs !== null ? r.reactionTimeMs.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2">{r.correct === null ? '—' : r.correct ? '✓' : '✗'}</td>
                  <td className="px-3 py-2">{r.excluded ? <span title={r.exclusionReason ?? ''}>Yes</span> : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="flex gap-2">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset((o) => o + PAGE_SIZE)} className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
