"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Archive, FlaskConical, PlayCircle, Plus, Users } from 'lucide-react';
import { experimentsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';
import { STATUS_BADGE } from '@/components/researcher/ExperimentHeader';

export default function ResearcherDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['researcher-experiments'],
    queryFn: () => experimentsApi.list({ limit: 100 }),
    refetchOnMount: 'always',
  });

  const experiments = data?.data ?? [];
  const cards = [
    { label: 'Experiments', value: data?.pagination.total ?? experiments.length, icon: FlaskConical, color: 'text-blue-600' },
    { label: 'Live now', value: experiments.filter((e) => e.status === 'PUBLISHED').length, icon: PlayCircle, color: 'text-emerald-600' },
    { label: 'Drafts', value: experiments.filter((e) => e.status === 'DRAFT').length, icon: Archive, color: 'text-amber-600' },
    { label: 'Sessions', value: experiments.reduce((s, e) => s + (e._count?.sessions ?? 0), 0), icon: Users, color: 'text-slate-700' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap gap-4 justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Researcher dashboard</h1>
          <p className="text-slate-500 mt-1">{user?.researcherProfile?.institution ? `${user.researcherProfile.institution} — ` : ''}Manage and analyze your experiments.</p>
        </div>
        <Link href="/researcher/experiments/new" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New experiment
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm text-slate-500 font-medium">{card.label}</span>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className={`text-3xl font-black ${card.color}`}>{isLoading ? '—' : card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50 font-semibold">Your experiments</div>
        {isLoading ? (
          <p className="p-8 text-slate-500">Loading…</p>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <p>{errorMessage(error, 'Failed to load experiments.')}</p>
            <button type="button" onClick={() => void refetch()} className="text-sm underline">
              Try again
            </button>
          </div>
        ) : experiments.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No experiments yet</h3>
            <Link href="/researcher/experiments/new" className="text-blue-600 font-semibold hover:underline">
              Create your first experiment →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b text-left">
                <tr>
                  <th className="px-5 py-3">Experiment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Visibility</th>
                  <th className="px-5 py-3 text-right">Sessions</th>
                  <th className="px-5 py-3 text-right">Reward</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr key={exp.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/researcher/experiments/${exp.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                        {exp.title}
                      </Link>
                      {exp.description && <div className="text-xs text-slate-400 truncate max-w-xs">{exp.description}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[exp.status].className}`}>{STATUS_BADGE[exp.status].label}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">{exp.visibility === 'PUBLIC' ? 'Public' : 'Private link'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{exp._count?.sessions ?? 0}</td>
                    <td className="px-5 py-3 text-right">{exp.rewardPoints} pts</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(exp.updatedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 space-x-3 whitespace-nowrap text-xs font-medium">
                      <Link href={`/researcher/experiments/${exp.id}/builder`} className="text-blue-600 hover:underline">
                        Builder
                      </Link>
                      <Link href={`/researcher/experiments/${exp.id}/results`} className="text-slate-600 hover:underline">
                        Results
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
