// ==============================================================================
// Form submissions: one spreadsheet-style row per completed session
// ==============================================================================
// Written by the server in the same transaction that completes a session (see
// SessionService.completeSession) and read by the "dataset" export, so every
// exported row is a stored database record, not something assembled by hand.

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { definitionFromSnapshot, type ExperimentDefinition, type ExperimentElement, type TrialResponsePayload } from '../../shared/experiment';

export interface SubmissionAnswer {
  elementId: string;
  trial: string;
  question: string;
  answer: string;
}

export interface QuestionColumn {
  elementId: string;
  trial: string;
  question: string;
}

function promptOf(el: ExperimentElement): string {
  return 'prompt' in el.config && typeof el.config.prompt === 'string' ? el.config.prompt.trim() : '';
}

/** Response elements in builder order, labelled by their question text (or the trial name). */
export function questionColumns(definition: ExperimentDefinition): QuestionColumn[] {
  const columns: QuestionColumn[] = [];
  definition.trials.forEach((trial, trialIndex) => {
    const trialName = trial.name.trim() || `Trial ${trialIndex + 1}`;
    for (const el of trial.elements) {
      if (el.role !== 'RESPONSE') continue;
      columns.push({ elementId: el.id, trial: trialName, question: promptOf(el) || trialName });
    }
  });
  return columns;
}

/** Answers in question order with display labels; unanswered questions are empty strings. */
export function buildSubmissionAnswers(definition: ExperimentDefinition, payloads: Array<TrialResponsePayload | null>) {
  const byElement = new Map<string, { display: string; correct: boolean | null | undefined }>();
  for (const payload of payloads) {
    for (const e of payload?.elements ?? []) byElement.set(e.elementId, { display: e.display, correct: e.correct });
  }
  let score = 0;
  let maxScore = 0;
  const answers: SubmissionAnswer[] = questionColumns(definition).map((c) => {
    const r = byElement.get(c.elementId);
    if (r && r.correct !== null && r.correct !== undefined) {
      maxScore += 1;
      if (r.correct) score += 1;
    }
    return { ...c, answer: r?.display ?? '' };
  });
  return { answers, score: maxScore > 0 ? score : null, maxScore: maxScore > 0 ? maxScore : null };
}

/**
 * Stores the submission row for a completed session. Idempotent: a session that
 * already has its row is left unchanged.
 */
export async function writeSubmission(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
  const existing = await tx.formSubmission.findUnique({ where: { sessionId }, select: { id: true } });
  if (existing) return;
  const session = await tx.experimentSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      id: true,
      experimentId: true,
      versionId: true,
      pseudonymousRef: true,
      startedAt: true,
      completedAt: true,
      version: { select: { versionNumber: true, configSnapshot: true } },
      participant: { select: { user: { select: { isGuest: true } } } },
      responses: { select: { response: true }, orderBy: { trialSequence: 'asc' } },
    },
  });
  const definition = definitionFromSnapshot(session.version.configSnapshot);
  const { answers, score, maxScore } = buildSubmissionAnswers(
    definition,
    session.responses.map((r) => (r.response as unknown as TrialResponsePayload | null) ?? null)
  );
  const submittedAt = session.completedAt ?? new Date();
  await tx.formSubmission.create({
    data: {
      sessionId: session.id,
      experimentId: session.experimentId,
      versionId: session.versionId,
      versionNumber: session.version.versionNumber,
      participantCode: session.pseudonymousRef,
      participantType: session.participant.user.isGuest ? 'guest' : 'registered',
      startedAt: session.startedAt,
      submittedAt,
      durationSeconds: Math.max(0, Math.round((submittedAt.getTime() - session.startedAt.getTime()) / 100) / 10),
      score,
      maxScore,
      answers: answers as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Creates rows for completed sessions that finished before this table existed. */
export async function backfillSubmissions(experimentId: string): Promise<number> {
  const missing = await prisma.experimentSession.findMany({
    where: { experimentId, completedAt: { not: null }, status: { in: ['COMPLETED', 'EXCLUDED'] }, submission: { is: null } },
    select: { id: true },
  });
  for (const s of missing) await prisma.$transaction((tx) => writeSubmission(tx, s.id));
  return missing.length;
}
