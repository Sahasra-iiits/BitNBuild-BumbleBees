"use client";
// Draft editing state for the builder.
//
// - The server draft is the source of truth; edits autosave after a short pause.
// - Only one save is in flight; edits made meanwhile are saved right after it, so an
//   older save can never overwrite newer state.
// - Every save carries the revision it was based on; if another tab/device saved in
//   between, the server answers 409 and autosave stops until the user chooses to
//   reload or overwrite.
// - Unsaved edits are mirrored to localStorage and offered for restore after a crash.

import { useCallback, useEffect, useRef, useState } from 'react';
import { experimentsApi } from '@/lib/api/experiments';
import { ApiRequestError, errorMessage } from '@/lib/api/client';
import { isRecord, readJson, removeKey, writeJson } from '@/lib/storage';
import { parseDefinition, stableStringify, type ExperimentDefinition } from '@/shared/experiment';
import type { DraftResponse } from '@/lib/types/api';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export interface LocalBackup {
  baseRevision: number;
  savedAt: string;
  definition: ExperimentDefinition;
}

const AUTOSAVE_DELAY_MS = 1000;
const RETRY_DELAYS_MS = [2000, 5000, 15000];

const backupKey = (id: string) => `bitnbuild:draft-backup:${id}`;
/** Where the previous builder kept drafts (browser only). Imported once, then removed. */
export const legacyDraftKey = (id: string) => `bitnbuild:experiment:${id}`;

function isBackup(value: unknown): value is { baseRevision: number; savedAt: string; definition: unknown } {
  return isRecord(value) && typeof value.baseRevision === 'number' && typeof value.savedAt === 'string' && 'definition' in value;
}

function isLegacyDraft(value: unknown): value is { trials: unknown[] } {
  return isRecord(value) && Array.isArray(value.trials);
}

export interface DraftEditor {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  definition: ExperimentDefinition | null;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: Date | null;
  /** A newer unsaved local copy found on load, offered for restore. */
  restorableBackup: LocalBackup | null;
  /** Set when a draft was imported from the old browser-only storage. */
  importedLegacyDraft: boolean;
  update: (mutate: (def: ExperimentDefinition) => ExperimentDefinition) => void;
  saveNow: () => Promise<boolean>;
  restoreBackup: () => void;
  discardBackup: () => void;
  reloadFromServer: () => Promise<void>;
  overwriteServer: () => Promise<void>;
}

export function useDraftEditor(experimentId: string): DraftEditor {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ExperimentDefinition | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restorableBackup, setRestorableBackup] = useState<LocalBackup | null>(null);
  const [importedLegacyDraft, setImportedLegacyDraft] = useState(false);

  const definitionRef = useRef<ExperimentDefinition | null>(null);
  const revisionRef = useRef(0);
  const changeCounterRef = useRef(0);
  const savedCounterRef = useRef(0);
  const inflightRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);
  const conflictRef = useRef(false);
  const mountedRef = useRef(true);
  const performSaveRef = useRef<() => Promise<void>>(async () => undefined);

  const isDirty = () => changeCounterRef.current !== savedCounterRef.current;

  const scheduleSave = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void performSaveRef.current();
    }, delay);
  }, []);

  /** One save attempt; resolves true on success. */
  const saveOnce = useCallback(
    async (snapshot: ExperimentDefinition, counterAtSave: number): Promise<boolean> => {
      try {
        const res = await experimentsApi.saveDraft(experimentId, snapshot, revisionRef.current);
        revisionRef.current = res.revision;
        savedCounterRef.current = counterAtSave;
        retryRef.current = 0;
        if (mountedRef.current) {
          setLastSavedAt(new Date(res.updatedAt));
          setSaveError(null);
          if (isDirty()) setSaveState('pending');
          else {
            removeKey(backupKey(experimentId));
            setSaveState('saved');
          }
        }
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        if (error instanceof ApiRequestError && error.code === 'DRAFT_CONFLICT') {
          conflictRef.current = true;
          setSaveState('conflict');
          setSaveError('This experiment was changed in another tab or session.');
          return false;
        }
        setSaveState('error');
        setSaveError(errorMessage(error, 'Saving failed.'));
        const delay = RETRY_DELAYS_MS[Math.min(retryRef.current, RETRY_DELAYS_MS.length - 1)];
        retryRef.current += 1;
        scheduleSave(delay);
        return false;
      }
    },
    [experimentId, scheduleSave]
  );

  const performSave = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (conflictRef.current || !definitionRef.current) return;
    if (inflightRef.current) {
      // Wait for the running save, then save whatever changed meanwhile.
      await inflightRef.current;
      return performSaveRef.current();
    }
    if (!isDirty()) {
      if (mountedRef.current) setSaveState('saved');
      return;
    }
    setSaveState('saving');
    const run = saveOnce(definitionRef.current, changeCounterRef.current);
    inflightRef.current = run;
    let ok = false;
    try {
      ok = await run;
    } finally {
      inflightRef.current = null;
    }
    if (ok && mountedRef.current && isDirty() && !conflictRef.current) return performSaveRef.current();
  }, [saveOnce]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** Replaces local state with a freshly fetched server draft. */
  const applyDraft = useCallback(
    (draft: DraftResponse) => {
      conflictRef.current = false;
      setLoadError(null);
      let def = draft.definition;
      let imported = false;

      // One-time import of a draft the old builder kept only in this browser.
      const legacy = readJson(legacyDraftKey(experimentId), isLegacyDraft);
      if (legacy && def.trials.length === 0 && legacy.trials.length > 0) {
        try {
          def = parseDefinition({ trials: legacy.trials });
          imported = true;
        } catch {
          // Unreadable legacy data is left untouched rather than half-imported.
        }
      }

      revisionRef.current = draft.revision;
      definitionRef.current = def;
      changeCounterRef.current = imported ? 1 : 0;
      savedCounterRef.current = 0;
      retryRef.current = 0;
      setDefinition(def);
      setImportedLegacyDraft(imported);
      setSaveState(imported ? 'pending' : 'saved');
      setSaveError(null);
      setLastSavedAt(draft.updatedAt ? new Date(draft.updatedAt) : null);

      let restorable: LocalBackup | null = null;
      const backup = readJson(backupKey(experimentId), isBackup);
      if (backup && !imported) {
        try {
          const backupDef = parseDefinition(backup.definition);
          if (backup.baseRevision === draft.revision && stableStringify(backupDef) !== stableStringify(def)) {
            restorable = { baseRevision: backup.baseRevision, savedAt: backup.savedAt, definition: backupDef };
          } else {
            removeKey(backupKey(experimentId));
          }
        } catch {
          removeKey(backupKey(experimentId));
        }
      }
      setRestorableBackup(restorable);
      setStatus('ready');
      if (imported) scheduleSave(0);
    },
    [experimentId, scheduleSave]
  );

  const applyLoadError = useCallback((error: unknown) => {
    setLoadError(errorMessage(error, 'The experiment could not be loaded.'));
    setStatus('error');
  }, []);

  const load = useCallback(() => experimentsApi.getDraft(experimentId).then(applyDraft, applyLoadError), [experimentId, applyDraft, applyLoadError]);

  useEffect(() => {
    let cancelled = false;
    experimentsApi.getDraft(experimentId).then(
      (draft) => !cancelled && applyDraft(draft),
      (error: unknown) => !cancelled && applyLoadError(error)
    );
    return () => {
      cancelled = true;
    };
  }, [experimentId, applyDraft, applyLoadError]);

  // Drop the imported legacy copy once it is safely on the server.
  useEffect(() => {
    if (importedLegacyDraft && saveState === 'saved') removeKey(legacyDraftKey(experimentId));
  }, [importedLegacyDraft, saveState, experimentId]);

  const update = useCallback(
    (mutate: (def: ExperimentDefinition) => ExperimentDefinition) => {
      const current = definitionRef.current;
      if (!current) return;
      const next = mutate(current);
      if (next === current) return;
      definitionRef.current = next;
      changeCounterRef.current += 1;
      setDefinition(next);
      writeJson(backupKey(experimentId), { baseRevision: revisionRef.current, savedAt: new Date().toISOString(), definition: next });
      if (conflictRef.current) return;
      setSaveState('pending');
      scheduleSave(AUTOSAVE_DELAY_MS);
    },
    [experimentId, scheduleSave]
  );

  /** Saves pending edits; resolves true only when everything is on the server. */
  const saveNow = useCallback(async () => {
    await performSaveRef.current();
    return !isDirty() && !conflictRef.current;
  }, []);

  const restoreBackup = useCallback(() => {
    if (!restorableBackup) return;
    const backupDef = restorableBackup.definition;
    setRestorableBackup(null);
    update(() => backupDef);
  }, [restorableBackup, update]);

  const discardBackup = useCallback(() => {
    removeKey(backupKey(experimentId));
    setRestorableBackup(null);
  }, [experimentId]);

  const reloadFromServer = useCallback(async () => {
    removeKey(backupKey(experimentId));
    setStatus('loading');
    await load();
  }, [experimentId, load]);

  /** Keeps the local version by saving it on top of the server's current revision. */
  const overwriteServer = useCallback(async () => {
    try {
      const current = await experimentsApi.getDraft(experimentId);
      revisionRef.current = current.revision;
      conflictRef.current = false;
      changeCounterRef.current += 1;
      await performSaveRef.current();
    } catch (error) {
      setSaveError(errorMessage(error));
      setSaveState('error');
    }
  }, [experimentId]);

  // Warn before leaving with unsaved or in-flight changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty() || inflightRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return {
    status,
    loadError,
    definition,
    saveState,
    saveError,
    lastSavedAt,
    restorableBackup,
    importedLegacyDraft,
    update,
    saveNow,
    restoreBackup,
    discardBackup,
    reloadFromServer,
    overwriteServer,
  };
}
