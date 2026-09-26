"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { publicExperimentsApi } from '@/lib/api/experiments';
import { FlaskConical } from 'lucide-react';

export default function DiscoveryPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-experiments'],
    queryFn: () => publicExperimentsApi.list(),
  });

  const experiments = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Available Experiments</h1>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border rounded-xl p-6 shadow-sm h-48 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-6"></div>
              <div className="flex gap-4 mb-6">
                <div className="h-6 bg-slate-200 rounded w-16"></div>
                <div className="h-6 bg-slate-200 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
          Failed to load experiments. Please try again later.
        </div>
      ) : experiments.length === 0 ? (
        <div className="p-16 text-center bg-white border rounded-xl shadow-sm">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No experiments available</h3>
          <p className="text-slate-500">Check back later for new studies!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {experiments.map(e => (
            <div key={e.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">{e.title}</h2>
                <p className="text-sm text-slate-500 mb-4 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  {e.researcher?.institution || e.researcher?.user?.email?.split('@')[0] || 'Independent Researcher'}
                </p>
                <div className="flex gap-4 text-sm mb-6">
                  <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-700">~15 mins</span>
                  <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full">+{e.rewardPoints} Points</span>
                </div>
              </div>
              <Link href={`/participant/experiments/${e.id}/run`} className="block text-center bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
                Start Experiment
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
