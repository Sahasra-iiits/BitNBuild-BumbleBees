"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import ExperimentRunner, { type TrialRecord } from '@/components/experiment/runtime/ExperimentRunner';
import { AssetCache } from '@/lib/experiment/asset-cache';
import { publicExperimentsApi } from '@/lib/api/experiments';
import { consentApi, CONSENT_TEXT } from '@/lib/api/consent';
import { EventOutbox, sessionsApi, type OutboxStatus } from '@/lib/api/sessions';
import { ApiRequestError, errorMessage } from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';
import { isRecord, readJson, removeKey, writeJson } from '@/lib/storage';
import { computeTrialOrder, createId, type ExperimentDefinition } from '@/shared/experiment';
import type { BatchEvent, CompletionOutcome, EligibilityResult, PublicExperiment } from '@/lib/types/api';

type Phase =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'intro' }
  | { kind: 'starting' }
  | { kind: 'preloading'; done: number; total: number }
  | { kind: 'asset_error'; failed: number }
  | { kind: 'running' }
  | { kind: 'submitting' }
  | { kind: 'save_error'; message: string; fatal: boolean }
  | { kind: 'completed'; outcome: CompletionOutcome };

interface RunState {
  sessionId: string;
  definition: ExperimentDefinition;
  order: number[];
  startPosition: number;
}

const REASON_LABEL: Record<string, string> = {
  EXPERIMENT_COMPLETION: 'Completed the study',
  EXTREMELY_FAST_RESPONSE: 'Many responses were extremely fast',
  REPEATED_IDENTICAL_RESPONSES: 'Many identical responses in a row',
  SKIPPED_REQUIRED_QUESTIONS: 'Required questions were left unanswered',
};

function isRunKey(value: unknown): value is { idempotencyKey: string } {
  return isRecord(value) && typeof value.idempotencyKey === 'string';
}

export default function ParticipantRunPage() {
  const { id: experimentId } = useParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [experiment, setExperiment] = useState<PublicExperiment | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [outboxStatus, setOutboxStatus] = useState<OutboxStatus | null>(null);
  const outboxRef = useRef<EventOutbox | null>(null);
  const cache = useMemo(() => new AssetCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);
  useEffect(() => () => outboxRef.current?.dispose(), []);

  const runKeyStorage = user ? `bitnbuild:run:${experimentId}:${user.id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exp, elig] = await Promise.all([publicExperimentsApi.get(experimentId), publicExperimentsApi.checkEligibility(experimentId)]);
        if (cancelled) return;
        setExperiment(exp);
        setEligibility(elig);
        setPhase({ kind: 'intro' });
      } catch (err) {
        if (!cancelled) setPhase({ kind: 'unavailable', message: errorMessage(err, 'This experiment is not available.') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [experimentId]);

  // Leaving mid-experiment asks for confirmation; recorded trials stay saved.
  useEffect(() => {
    if (phase.kind !== 'running' && phase.kind !== 'submitting') return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase.kind]);

  const finish = useCallback(
    async (sessionId: string) => {
      setPhase({ kind: 'submitting' });
      try {
        await outboxRef.current?.flushAll();
        const outcome = await sessionsApi.complete(sessionId);
        if (runKeyStorage) removeKey(runKeyStorage);
        setPhase({ kind: 'completed', outcome });
        void refreshUser();
      } catch (err) {
        const fatal = err instanceof ApiRequestError && err.statusCode >= 400 && err.statusCode < 500 && err.code !== 'SESSION_INCOMPLETE' && err.statusCode !== 429;
        setPhase({ kind: 'save_error', message: errorMessage(err, 'Your responses could not be saved.'), fatal });
      }
    },
    [refreshUser, runKeyStorage]
  );

  const begin = async () => {
    if (!experiment || !runKeyStorage) return;
    setPhase({ kind: 'starting' });
    try {
      const stored = readJson(runKeyStorage, isRunKey);
      const idempotencyKey = stored?.idempotencyKey ?? createId();
      writeJson(runKeyStorage, { idempotencyKey });

      let consentId: string | undefined;
      if (experiment.currentVersion) {
        consentId = (await consentApi.record({ experimentId, versionId: experiment.currentVersion.id })).id;
      }
      const started = await sessionsApi.start(experimentId, {
        idempotencyKey,
        consentId,
        clientMetadata: {
          userAgent: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`,
          devicePixelRatio: window.devicePixelRatio,
        },
      });

      const { session, version, progress } = started;
      if (session.status === 'COMPLETED') {
        const outcome = await sessionsApi.complete(session.id);
        removeKey(runKeyStorage);
        setPhase({ kind: 'completed', outcome });
        return;
      }
      if (session.status !== 'STARTED' && session.status !== 'IN_PROGRESS') {
        removeKey(runKeyStorage);
        setPhase({ kind: 'unavailable', message: 'This session can no longer be continued.' });
        return;
      }

      outboxRef.current?.dispose();
      const outbox = new EventOutbox(session.id);
      outbox.onStatus(setOutboxStatus);
      outboxRef.current = outbox;

      const definition = version.definition;
      const order = computeTrialOrder(definition, session.id);
      const recorded = new Set(progress.recordedTrialIds);
      // Trials finished before a reload whose events are still queued locally count too.
      const pendingKey = `bitnbuild:outbox:${session.id}`;
      const queued = readJson(pendingKey, (v): v is Array<{ trialId: string }> => Array.isArray(v));
      for (const e of queued ?? []) recorded.add(e.trialId);
      const startPosition = order.findIndex((idx) => !recorded.has(definition.trials[idx].id));

      if (startPosition === -1) {
        await finish(session.id);
        return;
      }

      setPhase({ kind: 'preloading', done: 0, total: 0 });
      const { failed } = await cache.preload(definition, (done, total) => setPhase({ kind: 'preloading', done, total }));
      setRun({ sessionId: session.id, definition, order, startPosition });
      if (failed.length > 0) {
        setPhase({ kind: 'asset_error', failed: failed.length });
        return;
      }
      setPhase({ kind: 'running' });
    } catch (err) {
      setPhase({ kind: 'unavailable', message: errorMessage(err, 'The experiment could not be started.') });
    }
  };

  const retryAssets = async () => {
    if (!run) return;
    setPhase({ kind: 'preloading', done: 0, total: 0 });
    const { failed } = await cache.preload(run.definition, (done, total) => setPhase({ kind: 'preloading', done, total }));
    setPhase(failed.length > 0 ? { kind: 'asset_error', failed: failed.length } : { kind: 'running' });
  };

  const onTrialComplete = useCallback((record: TrialRecord) => {
    const event: BatchEvent = {
      eventId: createId(),
      trialId: record.trial.id,
      trialSequence: record.position,
      stimulusDisplayTimestamp: record.onsetEpochMs,
      responseTimestamp: record.endEpochMs,
      reactionTimeMs: record.reactionTimeMs,
      response: {
        advanceReason: record.payload.advanceReason,
        elements: record.payload.elements.map((e) => ({ elementId: e.elementId, value: e.value, rtMs: e.rtMs })),
      },
      clientEventSequence: record.position,
    };
    outboxRef.current?.enqueue(event);
  }, []);

  const onFinished = useCallback(() => {
    if (run) void finish(run.sessionId);
  }, [run, finish]);

  // ---------------------------------------------------------------------------

  if (phase.kind === 'running' && run) {
    return (
      <>
        <ExperimentRunner definition={run.definition} order={run.order} startPosition={run.startPosition} assets={cache} seed={run.sessionId} onTrialComplete={onTrialComplete} onFinished={onFinished} />
        {outboxStatus?.fatal && (
          <div role="alert" className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow">
            Your responses could not be saved: {outboxStatus.lastError}
          </div>
        )}
      </>
    );
  }

  const card = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-start sm:items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border p-6 sm:p-8 space-y-6">{children}</div>
    </div>
  );

  switch (phase.kind) {
    case 'loading':
    case 'starting':
      return card(
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> {phase.kind === 'loading' ? 'Loading…' : 'Starting your session…'}
        </div>
      );
    case 'unavailable':
      return card(
        <>
          <h1 className="text-xl font-bold">Experiment unavailable</h1>
          <p className="text-red-700">{phase.message}</p>
          <Link href="/participant/experiments" className="text-blue-600 hover:underline">
            Back to experiments
          </Link>
        </>
      );
    case 'preloading':
      return card(
        <div className="flex items-center gap-2 text-slate-600" aria-live="polite">
          <Loader2 className="w-5 h-5 animate-spin" /> Preparing the experiment{phase.total > 0 ? ` (loading files ${phase.done}/${phase.total})` : ''}…
        </div>
      );
    case 'asset_error':
      return card(
        <>
          <h1 className="text-xl font-bold">Some files could not be loaded</h1>
          <p className="text-slate-600">{phase.failed} image or sound file(s) failed to download. Check your connection and try again.</p>
          <button type="button" onClick={() => void retryAssets()} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium">
            Try again
          </button>
        </>
      );
    case 'submitting':
      return card(
        <div className="flex items-center gap-2 text-slate-600" aria-live="polite">
          <Loader2 className="w-5 h-5 animate-spin" /> Saving your responses…
        </div>
      );
    case 'save_error':
      return card(
        <>
          <h1 className="text-xl font-bold">Your responses are not saved yet</h1>
          <p className="text-red-700">{phase.message}</p>
          {!phase.fatal && <p className="text-sm text-slate-600">They are kept in this browser. Keep this page open and retry, or come back later on this device.</p>}
          {run && (
            <button type="button" onClick={() => void finish(run.sessionId)} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium">
              Retry saving
            </button>
          )}
        </>
      );
    case 'completed': {
      const { outcome } = phase;
      return card(
        <div className="text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-bold">Thank you!</h1>
          <p className="text-slate-600">Your responses were saved.</p>
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-xl border p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase">Reward</div>
              <div className="text-2xl font-bold text-emerald-600">+{outcome.rewardPoints} pts</div>
              <div className="text-xs text-slate-500">Total {outcome.totalRewardPoints} pts</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase">Participant rating</div>
              <div className="text-2xl font-bold text-slate-900">{Math.round(outcome.currentRating)}</div>
              {outcome.ratingChanges.map((c, i) => (
                <div key={i} className={`text-xs flex items-center gap-1 ${c.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {c.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {c.delta > 0 ? '+' : ''}
                  {Math.round(c.delta)} · {REASON_LABEL[c.reason] ?? c.reason}
                </div>
              ))}
              {outcome.ratingChanges.length === 0 && <div className="text-xs text-slate-500">No change</div>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/participant/experiments" className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium">
              Find more experiments
            </Link>
            {!user?.isGuest && (
              <Link href="/participant/rating" className="px-5 py-2.5 rounded-lg border font-medium">
                Rating history
              </Link>
            )}
          </div>
        </div>
      );
    }
    case 'intro':
    default: {
      if (!experiment) return null;
      const blocked = eligibility && !eligibility.eligible;
      const resuming = !!eligibility?.attempts?.activeSessionId;
      return card(
        <>
          <div>
            <h1 className="text-2xl font-bold">{experiment.title}</h1>
            {experiment.researcher?.institution && <p className="text-sm text-slate-500">{experiment.researcher.institution}</p>}
          </div>
          {experiment.description && <p className="text-slate-700">{experiment.description}</p>}
          {experiment.instructions && (
            <div className="p-4 bg-blue-50 text-blue-900 rounded-lg whitespace-pre-wrap">
              <div className="text-xs font-semibold uppercase mb-1">Instructions</div>
              {experiment.instructions}
            </div>
          )}
          <div className="text-sm text-slate-600">
            Reward: <strong>{experiment.rewardPoints} points</strong> on completion ·{' '}
            {experiment.attemptPolicy === 'ALLOW_ONE_ATTEMPT' ? 'one attempt' : `up to ${experiment.maxAttempts} attempts`}
          </div>
          {blocked ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <div className="font-semibold">You cannot take part in this experiment</div>
              <div className="text-sm">{eligibility?.reason}</div>
              {eligibility?.code === 'ACCOUNT_REQUIRED' && (
                <Link href="/register" className="inline-block mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                  Create a free account
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="border rounded-lg p-4 bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{CONSENT_TEXT}</div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-blue-600" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I have read the information above and agree to take part.
              </label>
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Link href="/participant/experiments" className="px-5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">
                  Decline
                </Link>
                <button type="button" disabled={!agreed} onClick={() => void begin()} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40">
                  {resuming ? 'Continue where I left off' : 'Start experiment'}
                </button>
              </div>
            </>
          )}
        </>
      );
    }
  }
}
