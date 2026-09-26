"use client";
import Link from 'next/link';
import { Star, ShieldCheck, Trophy, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

export default function ParticipantDashboard() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="p-12 text-center text-slate-500">Loading profile...</div>;

  const profile = user?.participantProfile;
  const rating = profile?.qualityRating ?? 1200; // Like a chess ELO rating! (default 1200)
  const completedCount = profile?.completedSessionsCount ?? 0;
  
  // Calculate a level based on completed studies (e.g. 1 level per 5 studies)
  const currentLevel = Math.floor(completedCount / 5) + 1;
  const nextLevelThreshold = currentLevel * 5;
  const neededForNextLevel = nextLevelThreshold - completedCount;
  const progressPercent = ((completedCount % 5) / 5) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.email.split('@')[0] || 'Participant'}</h1>
          <p className="text-slate-500 mt-1">Ready to contribute to science today?</p>
        </div>
        <div className="text-right flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Participant Rating</div>
            <div className="text-2xl font-black text-blue-600">{Math.round(rating)}</div>
          </div>
          <ShieldCheck className="w-10 h-10 text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/participant/experiments" className="group bg-blue-600 text-white p-6 rounded-2xl shadow-md hover:bg-blue-700 transition-colors">
          <h3 className="text-xl font-bold mb-2">Find Experiments</h3>
          <p className="text-blue-100 text-sm mb-4">Discover new studies matching your eligibility.</p>
          <div className="flex justify-end"><ChevronRight className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" /></div>
        </Link>
        <div className="bg-white p-6 border rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-indigo-600"><Trophy className="w-5 h-5"/> <h3 className="font-bold">Level {currentLevel} Contributor</h3></div>
          <p className="text-slate-500 text-sm mb-4">Complete {neededForNextLevel} more studies to reach Level {currentLevel + 1}.</p>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
        <div className="bg-white p-6 border rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-amber-600"><Star className="w-5 h-5"/> <h3 className="font-bold">Reward Points</h3></div>
          <p className="text-slate-500 text-sm mb-4">Points you've earned from studies.</p>
          <div className="text-3xl font-black text-amber-500">{profile?.totalRewardPoints ?? 0} <span className="text-sm font-bold text-slate-400">pts</span></div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">In Progress</h2>
        <div className="bg-white border rounded-xl p-6 text-center text-slate-500">
          You don't have any incomplete studies.
        </div>
      </div>
    </div>
  );
}
