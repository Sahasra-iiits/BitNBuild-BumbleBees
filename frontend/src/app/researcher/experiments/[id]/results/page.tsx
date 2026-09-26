"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resultsApi } from '@/lib/api/results';
import { versionsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader } from '@/components/researcher/ExperimentHeader';
import type { StatSummary } from '@/lib/types/api';

const fmtMs = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} ms`);
const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);

function StatsTable({ rows, first }: { rows: Array<StatSummary & { label: string; sub?: string }>; first: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-4 py-2">{first}</th>
            <th className="text-right px-4 py-2" title="Responses (trials with a response element)">N</th>
            <th className="text-right px-4 py-2">Participants</th>
            <th className="text-right px-4 py-2">Mean RT</th>
            <th className="text-right px-4 py-2">Median RT</th>
            <th className="text-right px-4 py-2">SD</th>
            <th className="text-right px-4 py-2" title="Correct / scored responses">Accuracy</th>
            <th className="text-right px-4 py-2">Timeouts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label + (r.sub ?? '')} className="border-t">
              <td className="px-4 py-2 font-medium">
                {r.label}
                {r.sub && <span className="block text-xs text-slate-400 font-normal">{r.sub}</span>}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{r.n}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.participants}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtMs(r.meanRt)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtMs(r.medianRt)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtMs(r.sdRt)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {fmtPct(r.accuracy)}
                {r.scoredCount > 0 && <span className="block text-xs text-slate-400">of {r.scoredCount} scored</span>}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{r.timeouts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [versionId, setVersionId] = useState('');
  const versions = useQuery({ queryKey: ['versions', id], queryFn: () => versionsApi.list(id) });
  const results = useQuery({ queryKey: ['results', id, versionId], queryFn: () => resultsApi.getAggregate(id, versionId || undefined), refetchOnMount: 'always' });
  const data = results.data;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <ExperimentHeader id={id} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Version{' '}
          <select className="ml-1 border rounded-md px-2 py-1 text-sm" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            <option value="">All versions</option>
            {versions.data?.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void results.refetch()} className="text-sm px-3 py-1 border rounded-md hover:bg-slate-50">
          Refresh
        </button>
        {data && <span className="text-xs text-slate-400">Computed {new Date(data.computedAt).toLocaleString()}</span>}
      </div>

      {results.isLoading && <p className="text-slate-500">Computing results…</p>}
      {results.error && <p className="text-red-600">{errorMessage(results.error, 'Results could not be loaded.')}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ['Participants', data.summary.participants],
              ['Completed', data.summary.completedSessions],
              ['In progress', data.summary.inProgressSessions],
              ['Excluded', data.summary.excludedSessions],
              ['Analyzed responses', data.summary.analyzedResponses],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border rounded-xl p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Statistics use completed, non-excluded sessions and only trials that asked for a response. RT excludes timeouts. Accuracy counts a missed scored response as incorrect.
          </p>

          {data.conditions.length === 0 ? (
            <div className="bg-white border rounded-xl p-8 text-center text-slate-500">
              No completed responses yet. Results appear here as participants complete the experiment.
            </div>
          ) : (
            <>
              <section className="bg-white border rounded-xl overflow-hidden">
                <h2 className="font-semibold px-4 py-3 border-b">By condition</h2>
                <StatsTable first="Condition" rows={data.conditions.map((c) => ({ ...c, label: c.condition }))} />
              </section>
              <div className="grid md:grid-cols-2 gap-6">
                <section className="bg-white border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm">Mean RT by condition (ms)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.conditions.map((c) => ({ name: c.condition, value: c.meanRt ?? 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'Mean RT']} />
                      <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
                <section className="bg-white border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm">Accuracy by condition (%)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.conditions.filter((c) => c.accuracy !== null).map((c) => ({ name: c.condition, value: c.accuracy ?? 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Accuracy']} />
                      <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              </div>
              <section className="bg-white border rounded-xl overflow-hidden">
                <h2 className="font-semibold px-4 py-3 border-b">By trial</h2>
                <StatsTable first="Trial" rows={data.trials.map((t) => ({ ...t, label: t.name, sub: t.condition !== 'Unlabeled' ? `condition ${t.condition}` : undefined }))} />
              </section>
            </>
          )}
          <div className="flex gap-3">
            <Link href={`/researcher/experiments/${id}/data`} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50">
              View raw data
            </Link>
            <Link href={`/researcher/experiments/${id}/exports`} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">
              Export data
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
