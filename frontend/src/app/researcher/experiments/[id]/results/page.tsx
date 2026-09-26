"use client";
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { resultsApi } from '@/lib/api/results';
import { experimentsApi } from '@/lib/api/experiments';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: experiment } = useQuery({
    queryKey: ['experiment', id],
    queryFn: () => experimentsApi.get(id),
  });

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['results', id],
    queryFn: () => resultsApi.getAggregate(id),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Results Dashboard</h1>
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border rounded-xl p-6 animate-pulse"><div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div><div className="h-10 bg-slate-200 rounded w-1/2"></div></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Results Dashboard</h1>
        <div className="p-6 border border-red-200 bg-red-50 rounded-xl text-red-700">
          Failed to load results. The backend may not be available, or there are no results yet.
        </div>
      </div>
    );
  }

  const rtData = results?.aggregates?.map(r => ({
    name: r.condition,
    'Mean RT (ms)': Math.round(r.meanRt || 0),
    'Median RT (ms)': Math.round(r.medianRt || 0),
  })) || [];

  const accData = results?.aggregates?.map(r => ({
    name: r.condition,
    'Accuracy (%)': Math.round((r.accuracy || 0) * 100),
    'Error Rate (%)': Math.round((r.errorRate || 0) * 100),
  })) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
          <span>/</span>
          <span className="font-medium text-slate-700">{experiment?.title || id}</span>
          <span>/</span>
          <span>Results</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Results Dashboard</h1>
        {results?.computedAt && (
          <p className="text-sm text-slate-400 mt-1">Last computed: {new Date(results.computedAt).toLocaleString()}</p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Sessions', value: results?.totalSessions ?? '—', color: 'text-slate-900' },
          { label: 'Completed', value: results?.completedSessions ?? '—', color: 'text-emerald-600' },
          { label: 'Excluded', value: results?.excludedSessions ?? '—', color: 'text-red-500' },
        ].map(card => (
          <div key={card.label} className="bg-white border rounded-xl p-6 shadow-sm">
            <p className="text-sm text-slate-500 font-medium mb-1">{card.label}</p>
            <p className={`text-4xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Condition-level results */}
      {(results?.aggregates?.length ?? 0) > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50">
            <h2 className="font-semibold">Condition Aggregates</h2>
            <p className="text-xs text-slate-400 mt-0.5">Computed server-side. No inferences made here.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="text-left px-5 py-3">Condition</th>
                  <th className="text-right px-5 py-3">N</th>
                  <th className="text-right px-5 py-3">Mean RT</th>
                  <th className="text-right px-5 py-3">Median RT</th>
                  <th className="text-right px-5 py-3">SD</th>
                  <th className="text-right px-5 py-3">Accuracy</th>
                  <th className="text-right px-5 py-3">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {results?.aggregates?.map(r => (
                  <tr key={r.condition} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{r.condition}</td>
                    <td className="px-5 py-3 text-right">{r.n}</td>
                    <td className="px-5 py-3 text-right">{r.meanRt != null ? `${Math.round(r.meanRt)} ms` : '—'}</td>
                    <td className="px-5 py-3 text-right">{r.medianRt != null ? `${Math.round(r.medianRt)} ms` : '—'}</td>
                    <td className="px-5 py-3 text-right">{r.stdRt != null ? `${Math.round(r.stdRt)} ms` : '—'}</td>
                    <td className="px-5 py-3 text-right">{r.accuracy != null ? `${Math.round(r.accuracy * 100)}%` : '—'}</td>
                    <td className="px-5 py-3 text-right text-red-500">{r.errorRate != null ? `${Math.round(r.errorRate * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {rtData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h3 className="font-semibold mb-4">Reaction Time by Condition</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rtData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} ms`]} />
                <Legend />
                <Bar dataKey="Mean RT (ms)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Median RT (ms)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h3 className="font-semibold mb-4">Accuracy by Condition</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={accData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`]} />
                <Legend />
                <Bar dataKey="Accuracy (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Error Rate (%)" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href={`/researcher/experiments/${id}/data`}
          className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          View Raw Data →
        </Link>
        <Link
          href={`/researcher/experiments/${id}/exports`}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Export Data →
        </Link>
      </div>
    </div>
  );
}
