"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { experimentsApi } from '@/lib/api/experiments';
import type { ExperimentStatus } from '@/lib/types/api';

export const STATUS_BADGE: Record<ExperimentStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  PUBLISHED: { label: 'Live', className: 'bg-emerald-100 text-emerald-800' },
  PAUSED: { label: 'Paused', className: 'bg-amber-100 text-amber-800' },
  CLOSED: { label: 'Closed', className: 'bg-red-100 text-red-700' },
  ARCHIVED: { label: 'Archived', className: 'bg-slate-100 text-slate-500' },
};

export function useExperiment(id: string) {
  // Status and "unpublished changes" change from other pages (builder, publish), so never trust a cached copy on mount.
  return useQuery({ queryKey: ['experiment', id], queryFn: () => experimentsApi.get(id), refetchOnMount: 'always' });
}

export function ExperimentHeader({ id }: { id: string }) {
  const pathname = usePathname();
  const { data: experiment, error } = useExperiment(id);
  const base = `/researcher/experiments/${id}`;
  const tabs: Array<[string, string]> = [
    [base, 'Overview'],
    [`${base}/builder`, 'Builder'],
    [`${base}/participants`, 'Settings'],
    [`${base}/publish`, 'Publish'],
    [`${base}/results`, 'Results'],
    [`${base}/data`, 'Raw data'],
    [`${base}/quality`, 'Quality'],
    [`${base}/exports`, 'Exports'],
  ];
  return (
    <div className="space-y-4 mb-6">
      <div className="text-sm text-slate-500">
        <Link href="/researcher/experiments" className="hover:text-blue-600">
          Experiments
        </Link>{' '}
        / <span className="text-slate-700">{experiment?.title ?? '…'}</span>
      </div>
      {error && <p className="text-sm text-red-600">This experiment could not be loaded.</p>}
      {experiment && (
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{experiment.title}</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[experiment.status].className}`}>{STATUS_BADGE[experiment.status].label}</span>
          {experiment.hasUnpublishedChanges && experiment.versions.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">Unpublished changes</span>
          )}
        </div>
      )}
      <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Experiment sections">
        {tabs.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${pathname === href ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
