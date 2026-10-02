// ==============================================================================
// "Dataset" export: one row per completed response, one column per question
// ==============================================================================
// Spreadsheet layout like a Google Forms response sheet. Rows come from the
// form_submissions table (written by the server when each session completed);
// the long "one row per response" export in export-rows.ts is unchanged.

import { prisma } from '../../config/database';
import { definitionFromSnapshot } from '../../shared/experiment';
import { backfillSubmissions, questionColumns, type SubmissionAnswer } from '../submissions/submissions';
import { csvCell, type ExportFilters } from './export-rows';

export const DATASET_FIXED_COLUMNS = ['Timestamp (UTC)', 'participant_id', 'participant_type', 'duration_seconds'] as const;

export interface DatasetColumn {
  key: string;
  header: string;
}

export interface Dataset {
  columns: DatasetColumn[];
  rows: Array<Record<string, string | number | Date | null>>;
  submissionCount: number;
}

/** Question columns across all published versions: newest version's order first, then questions only older versions had. */
async function questionColumnsFor(experimentId: string): Promise<DatasetColumn[]> {
  const versions = await prisma.experimentVersion.findMany({
    where: { experimentId, publishedAt: { not: null } },
    orderBy: { versionNumber: 'desc' },
    select: { configSnapshot: true },
  });
  const seen = new Map<string, { trial: string; question: string }>();
  for (const v of versions) {
    for (const c of questionColumns(definitionFromSnapshot(v.configSnapshot))) {
      if (!seen.has(c.elementId)) seen.set(c.elementId, { trial: c.trial, question: c.question });
    }
  }
  // Headings must be unique: repeated question text gets the trial name, then a counter.
  const used = new Set<string>(DATASET_FIXED_COLUMNS.map((c) => c.toLowerCase()));
  const columns: DatasetColumn[] = [];
  for (const [elementId, c] of seen) {
    let header = c.question;
    if (used.has(header.toLowerCase())) header = `${c.question} [${c.trial}]`;
    for (let n = 2; used.has(header.toLowerCase()); n += 1) header = `${c.question} (${n})`;
    used.add(header.toLowerCase());
    columns.push({ key: `q:${elementId}`, header });
  }
  return columns;
}

export async function loadDataset(experimentId: string, filters: ExportFilters): Promise<Dataset> {
  await backfillSubmissions(experimentId);
  const submissions = await prisma.formSubmission.findMany({
    where: {
      experimentId,
      ...(filters.versionId ? { versionId: filters.versionId } : {}),
      ...(filters.includeExcluded ? {} : { session: { status: { not: 'EXCLUDED' } } }),
    },
    orderBy: { submittedAt: 'asc' },
  });

  const questions = await questionColumnsFor(experimentId);
  const scored = submissions.some((s) => s.maxScore !== null);
  const columns: DatasetColumn[] = [
    { key: 'timestamp', header: DATASET_FIXED_COLUMNS[0] },
    { key: 'participant_id', header: 'participant_id' },
    { key: 'participant_type', header: 'participant_type' },
    { key: 'duration_seconds', header: 'duration_seconds' },
    ...(scored ? [{ key: 'score', header: 'Score' }] : []),
    ...questions,
  ];

  const rows = submissions.map((s) => {
    const row: Record<string, string | number | Date | null> = {
      timestamp: s.submittedAt,
      participant_id: s.participantCode,
      participant_type: s.participantType,
      duration_seconds: s.durationSeconds,
    };
    if (scored) row.score = s.maxScore !== null ? `${s.score ?? 0} / ${s.maxScore}` : null;
    for (const a of s.answers as unknown as SubmissionAnswer[]) row[`q:${a.elementId}`] = a.answer;
    return row;
  });
  return { columns, rows, submissionCount: submissions.length };
}

/** "2026-10-01 12:55:07" in UTC, which Excel and Google Sheets read as a date-time. */
export function formatTimestamp(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function datasetToCsv(dataset: Dataset): string {
  const lines = [dataset.columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of dataset.rows) {
    lines.push(dataset.columns.map((c) => {
      const v = row[c.key];
      return csvCell(v instanceof Date ? formatTimestamp(v) : v);
    }).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function datasetToJson(experimentId: string, dataset: Dataset) {
  return {
    experiment_id: experimentId,
    generated_at: new Date().toISOString(),
    source_table: 'form_submissions',
    columns: dataset.columns.map((c) => c.header),
    rows: dataset.rows.map((row) =>
      Object.fromEntries(dataset.columns.map((c) => {
        const v = row[c.key];
        return [c.header, v instanceof Date ? v.toISOString() : v ?? ''];
      }))
    ),
  };
}
