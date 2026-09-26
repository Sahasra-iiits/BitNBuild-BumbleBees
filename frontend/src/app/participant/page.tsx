"use client";
import Link from 'next/link';
import { Star, ShieldCheck, Trophy, ChevronRight } from 'lucide-react';

export default function ParticipantDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, Participant</h1>
          <p className="text-slate-500 mt-1">Ready to contribute to science today?</p>
        </div>
        <div className="text-right flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Quality Score</div>
            <div className="text-2xl font-black text-blue-600">85<span className="text-slate-400 text-sm font-normal">/100</span></div>
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
          <div className="flex items-center gap-2 mb-2 text-indigo-600"><Trophy className="w-5 h-5"/> <h3 className="font-bold">Level 3 Researcher</h3></div>
          <p className="text-slate-500 text-sm mb-4">Complete 4 more studies to reach Level 4.</p>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-600 h-2 rounded-full w-3/4"></div></div>
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
