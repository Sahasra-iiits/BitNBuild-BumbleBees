"use client";
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { experimentsApi } from '@/lib/api/experiments';
import { qualityApi } from '@/lib/api/quality';
import { resultsApi } from '@/lib/api/results';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader, useExperiment } from '@/components/researcher/ExperimentHeader';
import { NumberField, Toggle } from '@/components/experiment/builder/fields';
import type { QualityFlag, QualityRules, SessionListItem } from '@/lib/types/api';

const SIGNAL_LABEL: Record<string, string> = {
  EXTREMELY_FAST_RESPONSES: 'Extremely fast responses',
  REPEATED_IDENTICAL_RESPONSES: 'Repeated identical responses',
  MISSED_REQUIRED_RESPONSES: 'Missed required responses',
};

export default function QualityPage() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment(id);
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <ExperimentHeader id={id} />
      {experiment && <RulesForm key={experiment.id} experimentId={id} initial={experiment.qualityRules} readOnly={experiment.status === 'ARCHIVED'} />}
      <FlagsSection experimentId={id} />
      <SessionsSection experimentId={id} />
    </div>
  );
}

function RulesForm({ experimentId, initial, readOnly }: { experimentId: string; initial: QualityRules; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<QualityRules>(initial);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => experimentsApi.update(experimentId, { qualityRules: rules }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['experiment', experimentId] });
    },
  });
  const patch = <K extends keyof QualityRules>(key: K, value: Partial<QualityRules[K]>) => {
    setRules((r) => ({ ...r, [key]: { ...r[key], ...value } }));
    setSaved(false);
  };
  const pct = (v: number | null) => (v === null ? 0 : Math.min(100, Math.max(0, v)) / 100);

  return (
    <section className="bg-white border rounded-xl p-5 space-y-5">
      <div>
        <h2 className="font-semibold">Automatic quality rules</h2>
        <p className="text-sm text-slate-500">Checked when a session completes. A triggered rule flags the session and lowers the participant&apos;s rating by its penalty (instead of the completion gain). Every change is recorded with its evidence.</p>
      </div>
      <fieldset disabled={readOnly} className="grid md:grid-cols-3 gap-5">
        <div className="space-y-3">
          <Toggle label="Extremely fast responses" checked={rules.fastResponses.enabled} onChange={(enabled) => patch('fastResponses', { enabled })} />
          <NumberField label="Faster than (ms)" integer min={50} value={rules.fastResponses.thresholdMs} onChange={(v) => v !== null && patch('fastResponses', { thresholdMs: v })} />
          <NumberField label="On more than (% of response trials)" min={0} value={Math.round(rules.fastResponses.maxFraction * 100)} onChange={(v) => patch('fastResponses', { maxFraction: pct(v) })} />
          <NumberField label="Rating penalty" integer min={0} value={rules.fastResponses.penalty} onChange={(v) => v !== null && patch('fastResponses', { penalty: Math.min(50, v) })} />
        </div>
        <div className="space-y-3">
          <Toggle label="Repeated identical responses" checked={rules.identicalResponses.enabled} onChange={(enabled) => patch('identicalResponses', { enabled })} />
          <NumberField label="Consecutive identical answers" integer min={3} value={rules.identicalResponses.runLength} onChange={(v) => v !== null && patch('identicalResponses', { runLength: v })} />
          <NumberField label="Rating penalty" integer min={0} value={rules.identicalResponses.penalty} onChange={(v) => v !== null && patch('identicalResponses', { penalty: Math.min(50, v) })} />
        </div>
        <div className="space-y-3">
          <Toggle label="Missed required responses" checked={rules.missedResponses.enabled} onChange={(enabled) => patch('missedResponses', { enabled })} />
          <NumberField label="On more than (% of response trials)" min={0} value={Math.round(rules.missedResponses.maxFraction * 100)} onChange={(v) => patch('missedResponses', { maxFraction: pct(v) })} />
          <NumberField label="Rating penalty" integer min={0} value={rules.missedResponses.penalty} onChange={(v) => v !== null && patch('missedResponses', { penalty: Math.min(50, v) })} />
        </div>
      </fieldset>
      {save.isError && <p className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
        <button type="button" disabled={readOnly || save.isPending} onClick={() => save.mutate()} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-40">
          Save rules
        </button>
      </div>
    </section>
  );
}

function FlagsSection({ experimentId }: { experimentId: string }) {
  const queryClient = useQueryClient();
  const flags = useQuery({ queryKey: ['flags', experimentId], queryFn: () => qualityApi.listFlags(experimentId) });
  const [penalties, setPenalties] = useState<Record<string, number | null>>({});
  const review = useMutation({
    mutationFn: ({ flag, status }: { flag: QualityFlag; status: 'CONFIRMED' | 'DISMISSED' }) =>
      qualityApi.reviewFlag(flag.id, { status, ratingPenalty: status === 'CONFIRMED' ? penalties[flag.id] ?? 0 : undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flags', experimentId] });
      void queryClient.invalidateQueries({ queryKey: ['quality-sessions', experimentId] });
    },
  });
  const list = flags.data?.data ?? [];
  return (
    <section className="bg-white border rounded-xl overflow-hidden">
      <h2 className="font-semibold px-5 py-3 border-b">Researcher flags</h2>
      {review.isError && <p className="px-5 py-2 text-sm text-red-600">{errorMessage(review.error)}</p>}
      {list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No flags. Flag a session below when you find evidence of low-quality participation.</p>
      ) : (
        <ul className="divide-y">
          {list.map((f) => (
            <li key={f.id} className="px-5 py-3 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-medium">{f.reason}</span> <span className="text-xs text-slate-500">· participant {f.participant ?? '—'} · {new Date(f.createdAt).toLocaleString()}</span>
                  {f.description && <p className="text-sm text-slate-600">{f.description}</p>}
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 h-fit">{f.status}</span>
              </div>
              {f.status === 'OPEN' && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <NumberField label="Rating penalty (0–50)" integer min={0} allowNull value={penalties[f.id] ?? 0} onChange={(v) => setPenalties((p) => ({ ...p, [f.id]: v === null ? null : Math.min(50, v) }))} />
                  </div>
                  <button type="button" disabled={review.isPending} onClick={() => review.mutate({ flag: f, status: 'CONFIRMED' })} className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm">
                    Confirm
                  </button>
                  <button type="button" disabled={review.isPending} onClick={() => review.mutate({ flag: f, status: 'DISMISSED' })} className="px-3 py-1.5 rounded-md border text-sm">
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SessionsSection({ experimentId }: { experimentId: string }) {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['quality-sessions', experimentId], queryFn: () => resultsApi.listSessions(experimentId, { limit: 100 }), refetchOnMount: 'always' });
  const [flagging, setFlagging] = useState<SessionListItem | null>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['quality-sessions', experimentId] });
    void queryClient.invalidateQueries({ queryKey: ['flags', experimentId] });
    void queryClient.invalidateQueries({ queryKey: ['results', experimentId] });
  };
  const createFlag = useMutation({
    mutationFn: () => qualityApi.createFlag({ sessionId: flagging!.id, reason: reason.trim(), description: description.trim() }),
    onSuccess: () => {
      setFlagging(null);
      setReason('');
      setDescription('');
      invalidate();
    },
  });
  const exclude = useMutation({
    mutationFn: ({ sessionId, why }: { sessionId: string; why: string }) => qualityApi.excludeSession(sessionId, why),
    onSuccess: invalidate,
  });

  const list = sessions.data?.data ?? [];
  return (
    <section className="bg-white border rounded-xl overflow-hidden">
      <h2 className="font-semibold px-5 py-3 border-b">Sessions</h2>
      {exclude.isError && <p className="px-5 py-2 text-sm text-red-600">{errorMessage(exclude.error)}</p>}
      {list.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No sessions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2">Participant</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ver.</th>
                <th className="px-4 py-2 text-right">Trials</th>
                <th className="px-4 py-2">Automatic signals</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t align-top">
                  <td className="px-4 py-2 font-mono text-xs">
                    {s.pseudonymousRef}
                    {s.isGuest && <span className="ml-1.5 font-sans text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Guest</span>}
                  </td>
                  <td className="px-4 py-2">{s.status}</td>
                  <td className="px-4 py-2">v{s.version.versionNumber}</td>
                  <td className="px-4 py-2 text-right">{s._count.responses}</td>
                  <td className="px-4 py-2">
                    {s.qualitySignals.length === 0 ? <span className="text-slate-400">—</span> : s.qualitySignals.map((q, i) => <div key={i} className="text-amber-800">{SIGNAL_LABEL[q.signalType] ?? q.signalType}</div>)}
                  </td>
                  <td className="px-4 py-2 space-x-3 whitespace-nowrap">
                    <button type="button" disabled={s.qualityFlags.some((f) => f.status === 'OPEN')} onClick={() => setFlagging(s)} className="text-blue-700 hover:underline disabled:opacity-40 disabled:no-underline">
                      Flag
                    </button>
                    {s.status !== 'EXCLUDED' && (
                      <button
                        type="button"
                        onClick={() => {
                          const why = window.prompt('Why are you excluding this session from analysis?');
                          if (why && why.trim()) exclude.mutate({ sessionId: s.id, why: why.trim() });
                        }}
                        className="text-red-700 hover:underline"
                      >
                        Exclude
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {flagging && (
        <div className="border-t p-5 space-y-3 bg-slate-50">
          <h3 className="font-semibold text-sm">Flag session of {flagging.pseudonymousRef}</h3>
          <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Reason (e.g. Did not follow instructions)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={3} placeholder="Evidence: what in the data shows this? (required, at least 10 characters)" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
          {createFlag.isError && <p className="text-sm text-red-600">{errorMessage(createFlag.error)}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={!reason.trim() || description.trim().length < 10 || createFlag.isPending} onClick={() => createFlag.mutate()} className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm disabled:opacity-40">
              Create flag
            </button>
            <button type="button" onClick={() => setFlagging(null)} className="px-3 py-1.5 rounded-md border text-sm">
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-500">A flag does not change the participant&apos;s rating until you review and confirm it.</p>
        </div>
      )}
    </section>
  );
}
