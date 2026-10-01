"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import ExperimentRunner, { type RunnerOverlayProps, type TrialRecord } from '@/components/experiment/runtime/ExperimentRunner';
import { IssueList } from '@/components/experiment/builder/IssueList';
import { AssetCache } from '@/lib/experiment/asset-cache';
import { experimentsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { computeTrialOrder, countBySeverity, createId, scoreTrial, validateDefinition, type ExperimentDefinition, type ResponseValue } from '@/shared/experiment';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' } | { kind: 'preloading'; done: number; total: number } | { kind: 'running' } | { kind: 'finished' };

interface ScoredRecord extends TrialRecord {
  correct: boolean | null;
  byElement: Record<string, boolean | null>;
}

interface OverlayState {
  last: ScoredRecord | null;
  missingAssets: number;
  onRestart: () => void;
  onExit: () => void;
}

const PreviewOverlayContext = createContext<OverlayState | null>(null);

/** Researcher-only controls drawn over the running preview. */
function PreviewOverlay({ position, total, trial, onSkip }: RunnerOverlayProps) {
  const state = useContext(PreviewOverlayContext);
  if (!state) return null;
  const { last } = state;
  return (
    <div className="fixed top-3 right-3 z-[60] w-64 rounded-lg bg-slate-900/90 text-slate-100 text-xs font-mono p-3 space-y-1.5 shadow-lg" aria-label="Preview controls">
      <div className="font-sans font-semibold text-white">Preview — nothing is recorded</div>
      <div>
        Trial {position + 1}/{total}: {trial.name || 'Untitled'}
      </div>
      <div className="text-slate-400">
        {trial.advanceMode}
        {trial.durationMs && trial.advanceMode !== 'manual' && trial.advanceMode !== 'response' ? ` · ${trial.durationMs} ms` : ''}
        {trial.condition ? ` · ${trial.condition}` : ''}
      </div>
      {last && (
        <div className="text-emerald-300" data-testid="preview-last">
          Last: {last.payload.advanceReason}
          {last.reactionTimeMs !== null ? ` · RT ${last.reactionTimeMs.toFixed(1)} ms` : ''}
          {last.correct !== null ? ` · ${last.correct ? 'correct' : 'incorrect'}` : ''}
        </div>
      )}
      {state.missingAssets > 0 && <div className="text-red-300">{state.missingAssets} file(s) failed to load</div>}
      <div className="flex gap-1.5 pt-1 font-sans">
        <button type="button" onClick={onSkip} className="flex-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
          Skip
        </button>
        <button type="button" onClick={state.onRestart} className="flex-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
          Restart
        </button>
        <button type="button" onClick={state.onExit} className="flex-1 px-2 py-1 rounded bg-red-700 hover:bg-red-600">
          Exit
        </button>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [definition, setDefinition] = useState<ExperimentDefinition | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [records, setRecords] = useState<ScoredRecord[]>([]);
  const [run, setRun] = useState<{ key: number; seed: string }>({ key: 0, seed: createId() });
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const cache = useMemo(() => new AssetCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([experimentsApi.getDraft(id), experimentsApi.get(id)]).then(
      ([draft, experiment]) => {
        if (cancelled) return;
        setDefinition(draft.definition);
        setTitle(experiment.title);
        setPhase({ kind: 'ready' });
      },
      (err: unknown) => !cancelled && setPhase({ kind: 'error', message: errorMessage(err, 'The draft could not be loaded.') })
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const issues = useMemo(() => (definition ? validateDefinition(definition) : []), [definition]);
  const counts = countBySeverity(issues);
  const order = useMemo(() => (definition ? computeTrialOrder(definition, run.seed) : []), [definition, run.seed]);

  const start = async () => {
    if (!definition) return;
    setRecords([]);
    setPhase({ kind: 'preloading', done: 0, total: 0 });
    const { failed } = await cache.preload(definition, (done, total) => setPhase({ kind: 'preloading', done, total }));
    setMissingAssets(failed);
    setRun((r) => ({ key: r.key + 1, seed: r.seed }));
    setPhase({ kind: 'running' });
  };

  const restart = () => {
    setRecords([]);
    setRun((r) => ({ key: r.key + 1, seed: definition?.settings.randomizeTrialOrder ? createId() : r.seed }));
    setPhase({ kind: 'running' });
  };

  const onTrialComplete = useCallback((record: TrialRecord) => {
    const values = new Map<string, ResponseValue>(record.payload.elements.map((e) => [e.elementId, e.value]));
    const score = scoreTrial(record.trial, values);
    setRecords((prev) => [...prev, { ...record, correct: score.correct, byElement: score.byElement }]);
  }, []);

  const onFinished = useCallback(() => setPhase({ kind: 'finished' }), []);

  if (phase.kind === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading preview…
      </div>
    );
  }
  if (phase.kind === 'error' || !definition) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-600">{phase.kind === 'error' ? phase.message : 'Nothing to preview.'}</p>
        <Link href={`/researcher/experiments/${id}/builder`} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm">
          Back to builder
        </Link>
      </div>
    );
  }

  if (phase.kind === 'running') {
    return (
      <PreviewOverlayContext.Provider value={{ last: records[records.length - 1] ?? null, missingAssets: missingAssets.length, onRestart: restart, onExit: () => setPhase({ kind: 'ready' }) }}>
        <ExperimentRunner key={run.key} definition={definition} order={order} assets={cache} seed={run.seed} onTrialComplete={onTrialComplete} onFinished={onFinished} Overlay={PreviewOverlay} />
      </PreviewOverlayContext.Provider>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href={`/researcher/experiments/${id}/builder`} className="text-sm text-slate-500 hover:text-blue-600">
            ← Back to builder
          </Link>
          <h1 className="text-2xl font-bold mt-2">Preview: {title}</h1>
          <p className="text-slate-600 text-sm mt-1">
            Runs the saved draft with the same runtime participants use. Responses are scored locally and shown below; nothing is sent to the server.
          </p>
        </div>

        {phase.kind === 'preloading' && (
          <div className="bg-white border rounded-xl p-5 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading files {phase.done}/{phase.total}…
          </div>
        )}

        {phase.kind === 'ready' && (
          <div className="bg-white border rounded-xl p-5 space-y-4">
            {definition.trials.length === 0 ? (
              <p className="text-slate-600">This experiment has no trials yet.</p>
            ) : (
              <>
                {counts.error > 0 && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {counts.error} error{counts.error === 1 ? '' : 's'} must be fixed before publishing. Some trials may not behave as intended in this preview.
                  </div>
                )}
                <IssueList issues={issues} />
                <button type="button" onClick={() => void start()} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
                  Start preview ({definition.trials.length} trial{definition.trials.length === 1 ? '' : 's'})
                </button>
              </>
            )}
          </div>
        )}

        {(phase.kind === 'finished' || (phase.kind === 'ready' && records.length > 0)) && (
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b flex justify-between items-center">
              <h2 className="font-semibold">{phase.kind === 'finished' ? 'Preview complete' : 'Partial preview'} — recorded data</h2>
              <button type="button" onClick={() => void start()} className="text-sm text-blue-600 hover:underline">
                Run again
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Trial</th>
                    <th className="px-3 py-2">Ended by</th>
                    <th className="px-3 py-2">Responses</th>
                    <th className="px-3 py-2 text-right">RT (ms)</th>
                    <th className="px-3 py-2">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.position} className="border-t">
                      <td className="px-3 py-2 text-slate-400">{r.position + 1}</td>
                      <td className="px-3 py-2">{r.trial.name}</td>
                      <td className="px-3 py-2">{r.payload.advanceReason}</td>
                      <td className="px-3 py-2">
                        {r.payload.elements.length === 0
                          ? '—'
                          : r.payload.elements.map((e) => (
                              <div key={e.elementId}>
                                {e.display} <span className="text-slate-400">({e.rtMs.toFixed(0)} ms)</span>
                              </div>
                            ))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.reactionTimeMs !== null ? r.reactionTimeMs.toFixed(1) : '—'}</td>
                      <td className="px-3 py-2">{r.correct === null ? '—' : r.correct ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
