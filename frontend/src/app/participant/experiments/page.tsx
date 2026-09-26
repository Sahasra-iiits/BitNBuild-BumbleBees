"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { publicExperimentsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';

export default function DiscoveryPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['public-experiments'], queryFn: () => publicExperimentsApi.list({ limit: 50 }), refetchOnMount: 'always' });
  const experiments = data?.data ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl font-bold tracking-tight">Available experiments</h1>
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-100 space-y-2">
          <p>{errorMessage(error, 'Failed to load experiments.')}</p>
          <button type="button" onClick={() => void refetch()} className="underline text-sm">
            Try again
          </button>
        </div>
      ) : experiments.length === 0 ? (
        <div className="p-16 text-center bg-white border rounded-xl">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">No experiments available</h2>
          <p className="text-slate-500">Check back later for new studies.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {experiments.map((e) => (
            <div key={e.id} className="bg-white border rounded-xl p-6 flex flex-col justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold mb-1">{e.title}</h2>
                <p className="text-sm text-slate-500 mb-3">{e.researcher?.institution ?? 'Independent researcher'}</p>
                {e.description && <p className="text-sm text-slate-700 line-clamp-3">{e.description}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-sm">+{e.rewardPoints} points</span>
                <Link href={`/participant/experiments/${e.id}/run`} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
                  View & start
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
