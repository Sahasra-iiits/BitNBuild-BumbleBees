"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Copy, FileUp, Loader2, Play, Plus, Rocket, Trash2 } from 'lucide-react';
import {
  addTrial,
  deleteElement,
  deleteTrial,
  duplicateElementIn,
  duplicateTrialIn,
  moveElement,
  moveTrial,
  updateElement,
  updateTrial,
  validateDefinition,
  countBySeverity,
  createElement,
  ADVANCE_MODES,
  type AdvanceMode,
  type ExperimentElement,
  type Trial,
  type ValidationIssue,
} from '@/shared/experiment';
import { useDraftEditor, type SaveState } from '@/lib/experiment/use-draft-editor';
import { AssetCache } from '@/lib/experiment/asset-cache';
import { readLegacyAsset } from '@/lib/experiment/legacy-local-assets';
import { assetsApi } from '@/lib/api/assets';
import { errorMessage } from '@/lib/api/client';
import { MediaEditor } from '@/components/experiment/builder/MediaEditor';
import {
  ChoiceEditor,
  DateTimeEditor,
  GridEditor,
  FixationEditor,
  KeyboardEditor,
  MouseClickEditor,
  SliderEditor,
  TextInputEditor,
  TextInstructionEditor,
  YesNoEditor,
} from '@/components/experiment/builder/ElementEditors';
import { IssueList } from '@/components/experiment/builder/IssueList';
import { NumberField, TextField, Toggle, Field, inputClass } from '@/components/experiment/builder/fields';
import { ADVANCE_MODE_HELP, ADVANCE_MODE_LABEL, elementLabel, RESPONSE_PRESETS, STIMULUS_PRESETS, type ElementPreset } from '@/components/experiment/builder/element-meta';
import { ImportQuestionsDialog } from '@/components/experiment/builder/ImportQuestionsDialog';

function SaveIndicator({ state, error, lastSavedAt, onRetry }: { state: SaveState; error: string | null; lastSavedAt: Date | null; onRetry: () => void }) {
  if (state === 'saving' || state === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-red-600" aria-live="assertive">
        Save failed{error ? `: ${error}` : ''} — retrying.
        <button type="button" onClick={onRetry} className="underline">
          Retry now
        </button>
      </span>
    );
  }
  if (state === 'conflict') return <span className="text-xs text-red-600">Not saved — changed elsewhere</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500" aria-live="polite">
      <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved{lastSavedAt ? ` ${lastSavedAt.toLocaleTimeString()}` : ''}
    </span>
  );
}

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const experimentId = params.id;
  const router = useRouter();
  const editor = useDraftEditor(experimentId);
  const { definition, update } = editor;
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [migration, setMigration] = useState<{ total: number; done: number; failed: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const migrationStarted = useRef(false);

  const cache = useMemo(() => new AssetCache(), []);
  useEffect(() => () => cache.dispose(), [cache]);

  const issues = useMemo(() => (definition ? validateDefinition(definition) : []), [definition]);
  const counts = countBySeverity(issues);

  // Keep a valid selection when trials are added/removed.
  const selectedTrial = definition?.trials.find((t) => t.id === selectedTrialId) ?? definition?.trials[0] ?? null;

  // Files the old builder stored only in this browser are uploaded once and re-linked.
  useEffect(() => {
    if (editor.status !== 'ready' || !definition || migrationStarted.current) return;
    const legacy: Array<{ trialId: string; element: Extract<ExperimentElement, { type: 'IMAGE_VISUAL' | 'AUDIO_SOUND' }> }> = [];
    for (const t of definition.trials) {
      for (const el of t.elements) {
        if ((el.type === 'IMAGE_VISUAL' || el.type === 'AUDIO_SOUND') && !el.config.assetId && el.config.url.startsWith('asset://')) {
          legacy.push({ trialId: t.id, element: el });
        }
      }
    }
    if (legacy.length === 0) return;
    migrationStarted.current = true;
    (async () => {
      let done = 0;
      let failed = 0;
      setMigration({ total: legacy.length, done, failed });
      for (const { trialId, element } of legacy) {
        try {
          const blob = await readLegacyAsset(element.config.url);
          if (!blob) throw new Error('not found in this browser');
          const file = new File([blob], `${element.type === 'IMAGE_VISUAL' ? 'image' : 'audio'}-${element.id.slice(0, 8)}`, { type: blob.type });
          const asset = await assetsApi.upload(experimentId, file);
          update((d) =>
            updateElement(d, trialId, element.id, (el) =>
              el.type === 'IMAGE_VISUAL' || el.type === 'AUDIO_SOUND' ? ({ ...el, config: { ...el.config, assetId: asset.id, assetName: asset.originalName, url: '' } } as typeof el) : el
            )
          );
          done += 1;
        } catch {
          failed += 1;
        }
        setMigration({ total: legacy.length, done, failed });
      }
    })();
  }, [editor.status, definition, experimentId, update]);

  const goTo = async (href: string, label: string) => {
    setNavError(null);
    setNavigating(label);
    try {
      // Preview and publish read the server draft, so unsaved edits must be stored first.
      if (!(await editor.saveNow())) throw new Error('Your latest changes could not be saved yet. Resolve the save problem first.');
      router.push(href);
    } catch (e) {
      setNavError(errorMessage(e));
      setNavigating(null);
    }
  };

  if (editor.status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading builder…
      </div>
    );
  }
  if (editor.status === 'error' || !definition) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-600">{editor.loadError ?? 'The experiment could not be loaded.'}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void editor.reloadFromServer()} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm">
            Try again
          </button>
          <Link href="/researcher/experiments" className="px-4 py-2 rounded-md border text-sm">
            Back to experiments
          </Link>
        </div>
      </div>
    );
  }

  const trialIssues = (trialId: string) => issues.filter((i) => i.trialId === trialId);
  const edit = (trialId: string, elementId: string) => (fn: (el: ExperimentElement) => ExperimentElement) =>
    update((d) => updateElement(d, trialId, elementId, fn));

  const onAddTrial = () => {
    let newId = '';
    update((d) => {
      const out = addTrial(d, selectedTrial?.id);
      newId = out.trialId;
      return out.definition;
    });
    if (newId) setSelectedTrialId(newId);
  };

  const onDuplicateTrial = (trialId: string) => {
    let newId: string | null = null;
    update((d) => {
      const out = duplicateTrialIn(d, trialId);
      newId = out.trialId;
      return out.definition;
    });
    if (newId) setSelectedTrialId(newId);
  };

  const onDeleteTrial = (trial: Trial, index: number) => {
    if (!window.confirm(`Delete "${trial.name || `Trial ${index + 1}`}" and its ${trial.elements.length} element(s)?`)) return;
    const neighbour = definition.trials[index + 1] ?? definition.trials[index - 1] ?? null;
    update((d) => deleteTrial(d, trial.id));
    setSelectedTrialId(neighbour?.id ?? null);
  };

  /** Adds a preset (e.g. Checkboxes = multiple choice with multiple selection) to a trial. */
  const addPreset = (trialId: string, p: ElementPreset) => {
    const el = createElement(p.type);
    const configured = p.configure ? p.configure(el) : el;
    update((d) => ({ ...d, trials: d.trials.map((t) => (t.id === trialId ? { ...t, elements: [...t.elements, configured] } : t)) }));
  };

  const onImportTrials = (trials: Trial[]) => {
    if (trials.length === 0) return;
    // Imported questions go after the selected trial (or at the end when none is selected).
    update((d) => {
      const index = selectedTrial ? d.trials.findIndex((t) => t.id === selectedTrial.id) : -1;
      const next = d.trials.slice();
      next.splice(index === -1 ? next.length : index + 1, 0, ...trials);
      return { ...d, trials: next };
    });
    // Selecting the last imported trial makes a following import or "Add trial" continue after it.
    setSelectedTrialId(trials[trials.length - 1].id);
    setImportOpen(false);
    setImportNotice(`Added ${trials.length} question trial${trials.length === 1 ? '' : 's'}.`);
  };

  const selectIssue = (issue: ValidationIssue) => {
    if (issue.trialId) setSelectedTrialId(issue.trialId);
    if (issue.elementId) {
      requestAnimationFrame(() => document.getElementById(`element-${issue.elementId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-6 py-3 flex flex-wrap gap-3 justify-between items-center shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/researcher/experiments/${experimentId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Experiment
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-sm font-semibold truncate">Builder</h1>
          <SaveIndicator state={editor.saveState} error={editor.saveError} lastSavedAt={editor.lastSavedAt} onRetry={() => void editor.saveNow()} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white text-sm font-medium hover:bg-slate-50"
          >
            <FileUp className="w-4 h-4" /> Import questions
          </button>
          <span className="text-xs text-slate-500 hidden sm:inline">
            {definition.trials.length} trial{definition.trials.length === 1 ? '' : 's'} · <span className={counts.error ? 'text-red-600 font-medium' : ''}>{counts.error} error{counts.error === 1 ? '' : 's'}</span> ·{' '}
            <span className={counts.warning ? 'text-amber-700' : ''}>{counts.warning} warning{counts.warning === 1 ? '' : 's'}</span>
          </span>
          <button
            type="button"
            disabled={!!navigating}
            onClick={() => void goTo(`/researcher/experiments/${experimentId}/preview`, 'preview')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {navigating === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Preview
          </button>
          <button
            type="button"
            disabled={!!navigating}
            onClick={() => void goTo(`/researcher/experiments/${experimentId}/publish`, 'publish')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {navigating === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Publish…
          </button>
        </div>
      </header>

      {/* Banners */}
      <div className="shrink-0 space-y-px">
        {navError && <div className="bg-red-50 text-red-700 text-sm px-6 py-2">{navError}</div>}
        {importNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-sm px-6 py-2 flex items-center gap-3" role="status">
            {importNotice}
            <button type="button" onClick={() => setImportNotice(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}
        {editor.saveState === 'conflict' && (
          <div className="bg-red-50 border-b border-red-200 text-red-800 text-sm px-6 py-2 flex flex-wrap items-center gap-3">
            <AlertTriangle className="w-4 h-4" /> This experiment was saved from another tab or session. Your latest edits are not saved.
            <button type="button" onClick={() => void editor.reloadFromServer()} className="underline font-medium">
              Load their version
            </button>
            <button type="button" onClick={() => void editor.overwriteServer()} className="underline font-medium">
              Keep my version
            </button>
          </div>
        )}
        {editor.restorableBackup && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-6 py-2 flex flex-wrap items-center gap-3">
            Unsaved changes from {new Date(editor.restorableBackup.savedAt).toLocaleString()} were found in this browser.
            <button type="button" onClick={editor.restoreBackup} className="underline font-medium">
              Restore them
            </button>
            <button type="button" onClick={editor.discardBackup} className="underline">
              Discard
            </button>
          </div>
        )}
        {editor.importedLegacyDraft && (
          <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-sm px-6 py-2">Your draft stored in this browser by the previous builder was imported and is now saved to your account.</div>
        )}
        {migration && (
          <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-sm px-6 py-2">
            Uploading files stored only in this browser: {migration.done}/{migration.total} done
            {migration.failed > 0 && <span className="text-red-700"> — {migration.failed} could not be found here; re-upload them (marked as errors).</span>}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Trials */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-3 pb-24">
            {definition.trials.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed rounded-xl text-slate-500">
                <p className="font-medium">No trials yet.</p>
                <p className="text-sm">Add a trial, then add stimuli and responses to it.</p>
              </div>
            )}
            {definition.trials.map((trial, index) => {
              const selected = trial.id === selectedTrial?.id;
              const tIssues = trialIssues(trial.id);
              const tCounts = countBySeverity(tIssues);
              return (
                <section key={trial.id} aria-label={`Trial ${index + 1}`} className={`bg-white border rounded-xl shadow-sm ${selected ? 'ring-2 ring-blue-500 border-transparent' : ''}`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <button type="button" onClick={() => setSelectedTrialId(trial.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left" aria-expanded={selected}>
                      <span className="w-7 h-7 shrink-0 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-900 truncate">{trial.name || 'Untitled trial'}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {ADVANCE_MODE_LABEL[trial.advanceMode]}
                          {trial.durationMs && (trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout') ? ` · ${trial.durationMs} ms` : ''}
                          {trial.condition ? ` · condition ${trial.condition}` : ''} · {trial.elements.length} element{trial.elements.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      {tCounts.error > 0 && <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{tCounts.error} error{tCounts.error === 1 ? '' : 's'}</span>}
                      {tCounts.error === 0 && tCounts.warning > 0 && <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{tCounts.warning} warning{tCounts.warning === 1 ? '' : 's'}</span>}
                    </button>
                    <div className="flex items-center gap-0.5 text-slate-400">
                      <button type="button" aria-label="Move trial up" disabled={index === 0} onClick={() => update((d) => moveTrial(d, trial.id, -1))} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label="Move trial down" disabled={index === definition.trials.length - 1} onClick={() => update((d) => moveTrial(d, trial.id, 1))} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label="Duplicate trial" onClick={() => onDuplicateTrial(trial.id)} className="p-1.5 rounded hover:bg-slate-100 hover:text-slate-700">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label="Delete trial" onClick={() => onDeleteTrial(trial, index)} className="p-1.5 rounded hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {selected && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {trial.elements.length === 0 && <p className="text-sm text-slate-500 text-center py-4">This trial is empty. Add a stimulus or a response below.</p>}
                      {trial.elements.map((el, elIndex) => {
                        const meta = elementLabel(el);
                        const Icon = meta.icon;
                        const elIssues = tIssues.filter((i) => i.elementId === el.id);
                        return (
                          <div key={el.id} id={`element-${el.id}`} className={`rounded-lg border p-4 ${elIssues.some((i) => i.severity === 'error') ? 'border-red-300' : 'border-slate-200'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${el.role === 'RESPONSE' ? 'text-emerald-600' : 'text-blue-600'}`} />
                                <span className="text-sm font-semibold">{meta.label}</span>
                                <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{el.role === 'RESPONSE' ? 'Response' : 'Stimulus'}</span>
                                {el.role === 'RESPONSE' && (
                                  <label className="flex items-center gap-1 text-xs text-slate-600 ml-2">
                                    <input type="checkbox" className="accent-blue-600" checked={el.required} onChange={(e) => edit(trial.id, el.id)((x) => (x.role === 'RESPONSE' ? { ...x, required: e.target.checked } : x))} />
                                    Required
                                  </label>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 text-slate-400">
                                <button type="button" aria-label="Move element up" disabled={elIndex === 0} onClick={() => update((d) => moveElement(d, trial.id, el.id, -1))} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30">
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" aria-label="Move element down" disabled={elIndex === trial.elements.length - 1} onClick={() => update((d) => moveElement(d, trial.id, el.id, 1))} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30">
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" aria-label="Duplicate element" onClick={() => update((d) => duplicateElementIn(d, trial.id, el.id))} className="p-1 rounded hover:bg-slate-100">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" aria-label="Delete element" onClick={() => update((d) => deleteElement(d, trial.id, el.id))} className="p-1 rounded hover:bg-red-50 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <ElementEditor element={el} edit={edit(trial.id, el.id)} experimentId={experimentId} cache={cache} />
                            {elIssues.length > 0 && (
                              <div className="mt-3">
                                <IssueList issues={elIssues} />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
                        <AddElementGroup title="Add stimulus" presets={STIMULUS_PRESETS} onAdd={(p) => addPreset(trial.id, p)} />
                        <AddElementGroup title="Add question / response" presets={RESPONSE_PRESETS} onAdd={(p) => addPreset(trial.id, p)} />
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
            <div className="flex justify-center pt-2">
              <button type="button" onClick={onAddTrial} className="inline-flex items-center gap-2 py-2.5 px-5 border border-slate-300 rounded-full text-sm font-medium text-slate-700 bg-white hover:border-blue-400 hover:text-blue-700 shadow-sm">
                <Plus className="w-4 h-4" /> Add trial
              </button>
            </div>
          </div>
        </main>

        {/* Inspector */}
        <aside className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l overflow-y-auto shrink-0 max-h-[45vh] lg:max-h-none">
          {selectedTrial ? (
            <TrialSettings key={selectedTrial.id} trial={selectedTrial} onChange={(patch) => update((d) => updateTrial(d, selectedTrial.id, patch))} />
          ) : (
            <p className="p-5 text-sm text-slate-500">Select a trial to edit its settings.</p>
          )}
          <div className="p-5 border-t space-y-3">
            <h2 className="text-sm font-semibold">Experiment settings</h2>
            <Toggle
              label="Randomize trial order for each participant"
              hint="Trials marked “keep position” stay where they are (e.g. instructions)."
              checked={definition.settings.randomizeTrialOrder}
              onChange={(randomizeTrialOrder) => update((d) => ({ ...d, settings: { ...d.settings, randomizeTrialOrder } }))}
            />
            <Link href={`/researcher/experiments/${experimentId}/participants`} className="block text-sm text-blue-600 hover:underline">
              Participant access, reward and attempts →
            </Link>
          </div>
          <div className="p-5 border-t space-y-3">
            <h2 className="text-sm font-semibold">
              Validation <span className="font-normal text-slate-500">({counts.error} errors, {counts.warning} warnings)</span>
            </h2>
            <IssueList issues={issues} onSelect={selectIssue} empty="No problems found — ready to preview and publish." />
          </div>
        </aside>
      </div>
      {importOpen && <ImportQuestionsDialog onClose={() => setImportOpen(false)} onImport={onImportTrials} startNumber={definition.trials.length + 1} />}
    </div>
  );
}

function AddElementGroup({ title, presets, onAdd }: { title: string; presets: ElementPreset[]; onAdd: (p: ElementPreset) => void }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const Icon = p.icon;
          return (
            <button key={p.key} type="button" title={p.description} onClick={() => onAdd(p)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 bg-white hover:border-blue-300 hover:bg-slate-50">
              <Icon className="w-3.5 h-3.5" /> {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ElementEditor({ element, edit, experimentId, cache }: { element: ExperimentElement; edit: (fn: (el: ExperimentElement) => ExperimentElement) => void; experimentId: string; cache: AssetCache }) {
  // Each editor receives an updater limited to its own element type.
  function typed<T extends ExperimentElement>(type: T['type']) {
    return (fn: (el: T) => T) => edit((el) => (el.type === type ? fn(el as T) : el));
  }
  switch (element.type) {
    case 'TEXT_INSTRUCTION':
      return <TextInstructionEditor element={element} edit={typed('TEXT_INSTRUCTION')} />;
    case 'FIXATION_CROSS':
      return <FixationEditor element={element} edit={typed('FIXATION_CROSS')} />;
    case 'IMAGE_VISUAL':
    case 'AUDIO_SOUND':
      return (
        <MediaEditor
          element={element}
          experimentId={experimentId}
          cache={cache}
          onChange={(fn) => edit((el) => (el.type === 'IMAGE_VISUAL' || el.type === 'AUDIO_SOUND' ? fn(el) : el))}
        />
      );
    case 'KEYBOARD_PRESS':
      return <KeyboardEditor element={element} edit={typed('KEYBOARD_PRESS')} />;
    case 'MOUSE_CLICK':
      return <MouseClickEditor element={element} edit={typed('MOUSE_CLICK')} />;
    case 'MULTIPLE_CHOICE':
      return <ChoiceEditor element={element} edit={typed('MULTIPLE_CHOICE')} />;
    case 'SLIDER_RATING':
      return <SliderEditor element={element} edit={typed('SLIDER_RATING')} />;
    case 'TEXT_INPUT':
      return <TextInputEditor element={element} edit={typed('TEXT_INPUT')} />;
    case 'YES_NO':
      return <YesNoEditor element={element} edit={typed('YES_NO')} />;
    case 'DATE_TIME':
      return <DateTimeEditor element={element} edit={typed('DATE_TIME')} />;
    case 'CHOICE_GRID':
      return <GridEditor element={element} edit={typed('CHOICE_GRID')} />;
  }
}

function TrialSettings({ trial, onChange }: { trial: Trial; onChange: (patch: Partial<Omit<Trial, 'id' | 'elements'>>) => void }) {
  const needsDuration = trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout';
  return (
    <div className="p-5 space-y-4">
      <h2 className="text-sm font-semibold">Trial settings</h2>
      <TextField label="Name" value={trial.name} maxLength={300} onChange={(name) => onChange({ name })} />
      <Field label="How the trial ends" hint={ADVANCE_MODE_HELP[trial.advanceMode]}>
        {(id) => (
          <select
            id={id}
            className={inputClass}
            value={trial.advanceMode}
            onChange={(e) => {
              const advanceMode = e.target.value as AdvanceMode;
              const timed = advanceMode === 'timed' || advanceMode === 'response_or_timeout';
              onChange({ advanceMode, durationMs: timed ? trial.durationMs ?? 2000 : trial.durationMs });
            }}
          >
            {ADVANCE_MODES.map((m) => (
              <option key={m} value={m}>
                {ADVANCE_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        )}
      </Field>
      {needsDuration && (
        <NumberField
          label={trial.advanceMode === 'timed' ? 'Duration (ms)' : 'Time limit (ms)'}
          integer
          min={1}
          allowNull
          value={trial.durationMs}
          onChange={(durationMs) => onChange({ durationMs })}
          hint="Measured from stimulus onset. Browser timers are accurate to about one screen refresh (~16 ms)."
        />
      )}
      <TextField label="Condition label" value={trial.condition} maxLength={100} placeholder="e.g. congruent" hint="Results are grouped by this label." onChange={(condition) => onChange({ condition })} />
      <Toggle label="Keep position when randomizing" checked={trial.fixedPosition} onChange={(fixedPosition) => onChange({ fixedPosition })} />
    </div>
  );
}
