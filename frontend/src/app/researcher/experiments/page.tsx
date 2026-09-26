"use client";
import { useQuery } from '@tanstack/react-query';
import { experimentsApi } from '@/lib/api/experiments';
import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExperimentStatus } from '@/lib/types/api';
import { Plus, FlaskConical, BarChart3, Users, PlayCircle, Archive, PauseCircle } from 'lucide-react';

const STATUS_BADGE: Record<ExperimentStatus, { label: string; className: string }> = {
  DRAFT:     { label: 'Draft',     className: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Live',      className: 'bg-emerald-100 text-emerald-700' },
  PAUSED:    { label: 'Paused',    className: 'bg-amber-100 text-amber-700' },
  CLOSED:    { label: 'Closed',    className: 'bg-red-100 text-red-700' },
  ARCHIVED:  { label: 'Archived',  className: 'bg-slate-100 text-slate-500 line-through' },
};

export default function ResearcherDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['researcher-experiments'],
    queryFn: () => experimentsApi.list(),
    enabled: !!user,
  });

  const experiments = data?.data || [];
  const totalSessions = experiments.reduce((s, e) => s + (e._count?.sessions || 0), 0);
  const livCount = experiments.filter(e => e.status === 'PUBLISHED').length;
  const draftCount = experiments.filter(e => e.status === 'DRAFT').length;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-6 py-2">
        {/* Greeting + CTA */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Researcher Dashboard</h1>
            <p className="text-slate-500 mt-1">
              {user?.researcherProfile?.institution ? `${user.researcherProfile.institution} — ` : ''}
              Manage and analyze your experiments.
            </p>
          </div>
          <Link
            href="/researcher/experiments/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Experiment
          </Link>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          {[
            { label: 'Total Experiments', value: experiments.length, icon: FlaskConical, color: 'text-blue-600' },
            { label: 'Live Now', value: livCount, icon: PlayCircle, color: 'text-emerald-600' },
            { label: 'Drafts', value: draftCount, icon: Archive, color: 'text-amber-600' },
            { label: 'Total Sessions', value: totalSessions, icon: Users, color: 'text-slate-700' },
          ].map(card => (
            <div key={card.label} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-slate-500 font-medium">{card.label}</span>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className={`text-3xl font-black ${card.color}`}>
                {isLoading ? '—' : card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Experiments Table */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-800">Your Experiments</h2>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="h-5 bg-slate-200 rounded w-48"></div>
                  <div className="h-5 bg-slate-200 rounded w-16"></div>
                  <div className="h-5 bg-slate-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              Failed to load experiments. Is the backend running?
            </div>
          ) : experiments.length === 0 ? (
            <div className="p-12 text-center">
              <FlaskConical className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No experiments yet</h3>
              <p className="text-slate-500 mb-4">Create your first experiment to get started.</p>
              <Link href="/researcher/experiments/new" className="text-blue-600 font-semibold hover:underline">
                Create Experiment →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="text-left px-5 py-3">Experiment</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Visibility</th>
                    <th className="text-right px-5 py-3">Sessions</th>
                    <th className="text-right px-5 py-3">Reward</th>
                    <th className="text-left px-5 py-3">Updated</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.map(exp => {
                    const badge = STATUS_BADGE[exp.status];
                    return (
                      <tr key={exp.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{exp.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{exp.description}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium ${exp.visibility === 'PUBLIC' ? 'text-blue-600' : 'text-slate-500'}`}>
                            {exp.visibility}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-700">{exp._count?.sessions ?? 0}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            +{exp.rewardPoints} pts
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">
                          {new Date(exp.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link href={`/researcher/experiments/${exp.id}/builder`} className="text-xs text-blue-600 hover:underline font-medium">
                              Builder
                            </Link>
                            {exp.status === 'PUBLISHED' ? (
                              <button 
                                onClick={async () => {
                                  try {
                                    const { experimentsApi } = await import('@/lib/api/experiments');
                                    await experimentsApi.update(exp.id, { status: 'DRAFT' } as any);
                                    queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
                                    queryClient.invalidateQueries({ queryKey: ['public-experiments'] });
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="text-xs text-amber-600 hover:underline font-medium"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <Link href={`/researcher/experiments/${exp.id}/publish`} className="text-xs text-emerald-600 hover:underline font-medium">
                                Publish
                              </Link>
                            )}
                            <Link href={`/researcher/experiments/${exp.id}/results`} className="text-xs text-slate-600 hover:underline font-medium">
                              Results
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
