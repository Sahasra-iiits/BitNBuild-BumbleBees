"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ShieldCheck, Star } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { sessionsApi } from '@/lib/api/sessions';

export default function ParticipantDashboard() {
  const { user } = useAuth();
  const sessions = useQuery({ queryKey: ['my-sessions'], queryFn: () => sessionsApi.listMine(), refetchOnMount: 'always' });
  const profile = user?.participantProfile;
  const unfinished = (sessions.data ?? []).filter((s) => (s.status === 'STARTED' || s.status === 'IN_PROGRESS') && s.experiment.status === 'PUBLISHED');

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user?.isGuest ? 'Welcome, guest' : 'Welcome back'}</h1>
          <p className="text-slate-500 mt-1">
            {user?.isGuest ? 'Guest code' : 'Participant code'} {profile?.pseudonymousId}
          </p>
        </div>
        <Link href="/participant/rating" className="flex items-center gap-4 bg-white p-4 rounded-xl border hover:border-blue-300">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Participant rating</div>
            <div className="text-2xl font-black text-blue-600">{profile ? Math.round(profile.qualityRating) : '—'}</div>
          </div>
          <ShieldCheck className="w-9 h-9 text-emerald-500" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/participant/experiments" className="group bg-blue-600 text-white p-6 rounded-2xl hover:bg-blue-700">
          <h3 className="text-xl font-bold mb-2">Find experiments</h3>
          <p className="text-blue-100 text-sm">Browse studies open to you.</p>
          <ChevronRight className="w-6 h-6 ml-auto mt-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <div className="bg-white p-6 border rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-amber-600">
            <Star className="w-5 h-5" /> <h3 className="font-bold">Reward points</h3>
          </div>
          <div className="text-3xl font-black text-amber-500">{profile?.totalRewardPoints ?? 0}</div>
        </div>
        <div className="bg-white p-6 border rounded-2xl">
          <h3 className="font-bold mb-2">Completed studies</h3>
          <div className="text-3xl font-black">{profile?.completedSessionsCount ?? 0}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-3">In progress</h2>
        {sessions.isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : unfinished.length === 0 ? (
          <div className="bg-white border rounded-xl p-6 text-center text-slate-500">You have no unfinished studies.</div>
        ) : (
          <ul className="space-y-2">
            {unfinished.map((s) => (
              <li key={s.id} className="bg-white border rounded-xl p-4 flex justify-between items-center">
                <span className="font-medium">{s.experiment.title}</span>
                <Link href={`/participant/experiments/${s.experimentId}/run`} className="text-sm text-blue-700 font-medium hover:underline">
                  Continue →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
