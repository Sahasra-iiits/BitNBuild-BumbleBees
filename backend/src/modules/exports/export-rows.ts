// ==============================================================================
// Export row building
// ==============================================================================
// "Tidy" long format: one row per recorded element response, plus one row for
// each trial that had no response elements (instructions, fixation, ...), so the
// full trial sequence of every session is present. Columns are documented in
// EXPORT_CODEBOOK and shared by CSV, XLSX and the JSON export.

import { prisma } from '../../config/database';
import type { TrialResponsePayload } from '../../shared/experiment';

export interface ExportFilters {
  includeExcluded?: boolean;
  versionId?: string;
}

export interface ExportRow {
  participant_id: string;
  participant_type: 'guest' | 'registered';
  session_id: string;
  session_status: string;
  session_quality: string | null;
  experiment_id: string;
  version_number: number;
  version_id: string;
  trial_id: string;
  trial_name: string | null;
  trial_sequence: number;
  condition: string | null;
  advance_reason: string | null;
  trial_rt_ms: number | null;
  trial_correct: boolean | null;
  timeout: boolean;
  element_id: string | null;
  element_type: string | null;
  response_value: string | null;
  response_label: string | null;
  element_rt_ms: number | null;
  element_correct: boolean | null;
  stimulus_onset_epoch_ms: number | null;
  response_epoch_ms: number | null;
  excluded: boolean;
  exclusion_reason: string | null;
}

export const EXPORT_COLUMNS: Array<keyof ExportRow> = [
  'participant_id',
  'participant_type',
  'session_id',
  'session_status',
  'session_quality',
  'experiment_id',
  'version_number',
  'version_id',
  'trial_id',
  'trial_name',
  'trial_sequence',
  'condition',
  'advance_reason',
  'trial_rt_ms',
  'trial_correct',
  'timeout',
  'element_id',
  'element_type',
  'response_value',
  'response_label',
  'element_rt_ms',
  'element_correct',
  'stimulus_onset_epoch_ms',
  'response_epoch_ms',
  'excluded',
  'exclusion_reason',
];

export const EXPORT_CODEBOOK: Record<keyof ExportRow, string> = {
  participant_id: 'Pseudonymous participant code (no personal data).',
  participant_type: '"guest" (took part without an account, no demographics) or "registered".',
  session_id: 'Experiment session (one attempt by one participant).',
  session_status: 'STARTED, IN_PROGRESS, COMPLETED, ABANDONED or EXCLUDED.',
  session_quality: 'CLEAN, FLAGGED (automatic quality rule triggered) or EXCLUDED.',
  experiment_id: 'Experiment id.',
  version_number: 'Published version the session ran on.',
  version_id: 'Published version id.',
  trial_id: 'Stable builder trial id (identical across versions).',
  trial_name: 'Trial name as configured.',
  trial_sequence: 'Zero-based presentation position within the session.',
  condition: 'Condition label configured on the trial (empty if none).',
  advance_reason: 'How the trial ended: response, submit, continue or timeout.',
  trial_rt_ms: 'Milliseconds from stimulus onset to the response that ended the trial (browser performance.now()); empty for timeouts and display-only trials.',
  trial_correct: 'TRUE if every scored element was correct, FALSE if any was incorrect or missed; empty if nothing was scored.',
  timeout: 'TRUE if the trial ended because its time limit elapsed.',
  element_id: 'Response element id (empty on rows for trials without responses).',
  element_type: 'KEYBOARD_PRESS, MULTIPLE_CHOICE, SLIDER_RATING, TEXT_INPUT, YES_NO or MOUSE_CLICK.',
  response_value: 'Raw value: key name, option id, number, text, true/false, or JSON {x,y} (0-1 viewport fraction).',
  response_label: 'Human-readable value (option label, key label, Yes/No label).',
  element_rt_ms: 'Milliseconds from stimulus onset to this element response.',
  element_correct: 'Correctness of this element (empty when the element is not scored).',
  stimulus_onset_epoch_ms: 'Client wall-clock time of stimulus onset (ms since 1970-01-01, performance.timeOrigin based).',
  response_epoch_ms: 'Client wall-clock time when the trial ended.',
  excluded: 'TRUE if the researcher excluded this response or its session.',
  exclusion_reason: 'Reason given for the exclusion.',
};

function valueToString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function participantType(session: { participant: { user: { isGuest: boolean } } }): 'guest' | 'registered' {
  return session.participant.user.isGuest ? 'guest' : 'registered';
}

export async function loadExportData(experimentId: string, filters: ExportFilters) {
  const sessionWhere = {
    experimentId,
    ...(filters.versionId ? { versionId: filters.versionId } : {}),
    ...(filters.includeExcluded ? {} : { status: { not: 'EXCLUDED' as const } }),
  };
  return prisma.trialResponse.findMany({
    where: { session: sessionWhere, ...(filters.includeExcluded ? {} : { excluded: false }) },
    include: {
      session: {
        select: {
          id: true,
          pseudonymousRef: true,
          status: true,
          qualityStatus: true,
          versionId: true,
          version: { select: { versionNumber: true } },
          participant: { select: { user: { select: { isGuest: true } } } },
        },
      },
      trial: { select: { id: true, trialKey: true, name: true } },
    },
    orderBy: [{ session: { startedAt: 'asc' } }, { sessionId: 'asc' }, { trialSequence: 'asc' }],
    take: 200000,
  });
}

export type ExportData = Awaited<ReturnType<typeof loadExportData>>;

export function buildExportRows(experimentId: string, data: ExportData): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const r of data) {
    const payload = r.response as unknown as TrialResponsePayload | null;
    const base = {
      participant_id: r.session.pseudonymousRef,
      participant_type: participantType(r.session),
      session_id: r.session.id,
      session_status: r.session.status,
      session_quality: r.session.qualityStatus,
      experiment_id: experimentId,
      version_number: r.session.version.versionNumber,
      version_id: r.session.versionId,
      trial_id: r.trial.trialKey ?? r.trial.id,
      trial_name: r.trial.name,
      trial_sequence: r.trialSequence,
      condition: r.condition,
      advance_reason: payload?.advanceReason ?? null,
      trial_rt_ms: r.reactionTimeMs,
      trial_correct: r.correct,
      timeout: r.timeout,
      stimulus_onset_epoch_ms: r.stimulusDisplayTimestamp !== null ? Number(r.stimulusDisplayTimestamp) : null,
      response_epoch_ms: r.responseTimestamp !== null ? Number(r.responseTimestamp) : null,
      excluded: r.excluded,
      exclusion_reason: r.exclusionReason,
    };
    const elements = payload?.elements ?? [];
    if (elements.length === 0) {
      rows.push({ ...base, element_id: null, element_type: null, response_value: null, response_label: null, element_rt_ms: null, element_correct: null });
      continue;
    }
    for (const e of elements) {
      rows.push({
        ...base,
        element_id: e.elementId,
        element_type: e.type,
        response_value: valueToString(e.value),
        response_label: e.display ?? null,
        element_rt_ms: e.rtMs,
        element_correct: e.correct ?? null,
      });
    }
  }
  return rows;
}

/**
 * RFC 4180 quoting. Cells starting with = + - @ (or tab/CR) are prefixed with an
 * apostrophe so participant-typed text cannot run as a spreadsheet formula.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const row of rows) lines.push(EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Nested JSON: sessions -> trials -> element responses. BigInt timestamps become numbers. */
export function toJsonDocument(experimentId: string, filters: ExportFilters, data: ExportData) {
  const sessions = new Map<string, { session_id: string; participant_id: string; participant_type: string; status: string; quality: string | null; version_number: number; version_id: string; trials: unknown[] }>();
  for (const r of data) {
    if (!sessions.has(r.session.id)) {
      sessions.set(r.session.id, {
        session_id: r.session.id,
        participant_id: r.session.pseudonymousRef,
        participant_type: participantType(r.session),
        status: r.session.status,
        quality: r.session.qualityStatus,
        version_number: r.session.version.versionNumber,
        version_id: r.session.versionId,
        trials: [],
      });
    }
    const payload = r.response as unknown as TrialResponsePayload | null;
    sessions.get(r.session.id)!.trials.push({
      trial_id: r.trial.trialKey ?? r.trial.id,
      trial_name: r.trial.name,
      trial_sequence: r.trialSequence,
      condition: r.condition,
      advance_reason: payload?.advanceReason ?? null,
      reaction_time_ms: r.reactionTimeMs,
      correct: r.correct,
      timeout: r.timeout,
      stimulus_onset_epoch_ms: r.stimulusDisplayTimestamp !== null ? Number(r.stimulusDisplayTimestamp) : null,
      response_epoch_ms: r.responseTimestamp !== null ? Number(r.responseTimestamp) : null,
      excluded: r.excluded,
      exclusion_reason: r.exclusionReason,
      responses: payload?.elements ?? [],
    });
  }
  return {
    experiment_id: experimentId,
    exported_at: new Date().toISOString(),
    filters: { include_excluded: !!filters.includeExcluded, version_id: filters.versionId ?? null },
    sessions: Array.from(sessions.values()),
  };
}
