"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy } from 'lucide-react';
import { experimentsApi } from '@/lib/api/experiments';
import { ApiRequestError, errorMessage } from '@/lib/api/client';
import { ExperimentHeader, useExperiment } from '@/components/researcher/ExperimentHeader';
import { IssueList } from '@/components/experiment/builder/IssueList';
import { collectAssetIds, getResponseElements, isScoringEnabled, type ValidationIssue } from '@/shared/experiment';
import type { PublishResponse } from '@/lib/types/api';

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: experiment } = useExperiment(id);
  // Always refetch: the draft may have just been edited in the builder.
  const draft = useQuery({ queryKey: ['draft', id], queryFn: () => experimentsApi.getDraft(id), refetchOnMount: 'always' });
  const validation = useQuery({ queryKey: ['draft-validation', id], queryFn: () => experimentsApi.validateDraft(id), refetchOnMount: 'always' });
  const [acknowledged, setAcknowledged] = useState(false);
  const [serverIssues, setServerIssues] = useState<ValidationIssue[] | null>(null);
  const [result, setResult] = useState<PublishResponse | null>(null);

  const publish = useMutation({
    mutationFn: () => experimentsApi.publish(id),
    onSuccess: (res) => {
      setResult(res);
      setServerIssues(null);
      void queryClient.invalidateQueries({ queryKey: ['experiment', id] });
      void queryClient.invalidateQueries({ queryKey: ['versions', id] });
      void queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'PUBLISH_VALIDATION_FAILED') {
        const details = err.details as { issues?: ValidationIssue[] } | undefined;
        setServerIssues(details?.issues ?? []);
      }
    },
  });

  const participantLink = typeof window !== 'undefined' ? `${window.location.origin}/participant/experiments/${id}/run` : '';

  if (result) {
    return (
      <div className="max-w-3xl mx-auto">
        <ExperimentHeader id={id} />
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h2 className="text-2xl font-bold text-emerald-900">
            {result.version.created ? `Version ${result.version.versionNumber} is live` : `Live on version ${result.version.versionNumber} (no changes since last publish)`}
          </h2>
          <div className="flex flex-wrap gap-2 bg-white border rounded-lg p-3 text-left">
            <code className="flex-1 min-w-0 truncate text-sm">{participantLink}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(participantLink)} className="inline-flex items-center gap-1 px-3 py-1.5 border rounded text-sm">
              <Copy className="w-4 h-4" /> Copy link
            </button>
          </div>
          <Link href={`/researcher/experiments/${id}`} className="inline-block text-blue-700 hover:underline">
            Go to experiment overview
          </Link>
        </div>
      </div>
    );
  }

  const def = draft.data?.definition;
  const issues = serverIssues ?? validation.data?.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const responses = def ? def.trials.flatMap((t) => getResponseElements(t)) : [];
  const status = experiment?.status;
  const publishable = status === 'DRAFT' || status === 'PAUSED' || status === 'PUBLISHED';
  const nothingNew = status === 'PUBLISHED' && experiment?.hasUnpublishedChanges === false;
  const canPublish = !!def && publishable && errors === 0 && (warnings === 0 || acknowledged) && !nothingNew && !publish.isPending;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <ExperimentHeader id={id} />
      {(draft.isLoading || validation.isLoading) && <p className="text-slate-500">Checking the experiment…</p>}
      {(draft.error || validation.error) && <p className="text-red-600">{errorMessage(draft.error ?? validation.error)}</p>}
      {def && validation.data && experiment && (
        <div className="space-y-6">
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Pre-flight summary</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {[
                ['Trials', def.trials.length],
                ['Response elements', responses.length],
                ['Scored responses', responses.filter(isScoringEnabled).length],
                ['Uploaded files', collectAssetIds(def).length],
                ['Errors', errors],
                ['Warnings', warnings],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className={`text-xl font-bold ${label === 'Errors' && Number(value) > 0 ? 'text-red-600' : label === 'Warnings' && Number(value) > 0 ? 'text-amber-700' : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-500 mt-4">
              Randomized order: {def.settings.randomizeTrialOrder ? 'yes' : 'no'} · Visibility: {experiment.visibility === 'PUBLIC' ? 'public' : 'private link'} · Reward: {experiment.rewardPoints} pts ·{' '}
              {experiment.attemptPolicy === 'ALLOW_ONE_ATTEMPT' ? 'one attempt' : `up to ${experiment.maxAttempts} attempts`} · {experiment.eligibilityRules.length} eligibility rule(s).{' '}
              <Link href={`/researcher/experiments/${id}/participants`} className="text-blue-600 hover:underline">
                Change settings
              </Link>
            </p>
          </section>

          <section className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold">Validation</h2>
            <IssueList issues={issues} empty="No problems found." />
            {errors > 0 && (
              <p className="text-sm text-red-700">
                Publishing is blocked until the errors are fixed in the{' '}
                <Link href={`/researcher/experiments/${id}/builder`} className="underline">
                  builder
                </Link>
                .
              </p>
            )}
          </section>

          {!publishable && <p className="text-sm text-amber-800">A {status?.toLowerCase()} experiment cannot be published.</p>}
          {nothingNew && <p className="text-sm text-slate-600">The live version already matches the draft. Edit the experiment in the builder to publish an update.</p>}

          {errors === 0 && publishable && !nothingNew && (
            <section className="bg-white border rounded-xl p-5 space-y-4">
              {warnings > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-blue-600" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                  I have reviewed the {warnings} warning{warnings === 1 ? '' : 's'} above and want to publish anyway.
                </label>
              )}
              <p className="text-sm text-slate-600">
                Publishing freezes the current draft as version {experiment.versions.length + 1}. Participants already in progress continue on the version they started.
              </p>
              {publish.isError && <p className="text-sm text-red-600">{errorMessage(publish.error)}</p>}
              <button type="button" disabled={!canPublish} onClick={() => publish.mutate()} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40">
                {publish.isPending ? 'Publishing…' : status === 'PUBLISHED' ? 'Publish update' : 'Publish experiment'}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
