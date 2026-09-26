// ==============================================================================
// SynapseLab — Results Service
// ==============================================================================
// All statistics are computed from recorded, non-excluded trial responses of
// completed, non-excluded sessions. Nothing is estimated or synthesized.

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import type { TrialResponsePayload } from '../../shared/experiment';

async function assertOwner(experimentId: string, researcherProfileId: string) {
  const experiment = await prisma.experiment.findUnique({ where: { id: experimentId }, select: { researcherId: true } });
  if (!experiment) throw new NotFoundError('Experiment not found');
  if (experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');
}

interface Sample {
  rt: number | null;
  correct: boolean | null;
  timeout: boolean;
  /** Internal participant profile id; only used for counting distinct people. */
  participantId: string;
}

function round2(n: number | null): number | null {
  return n === null ? null : Math.round(n * 100) / 100;
}

export function summarize(samples: Sample[]) {
  const rts = samples.filter((s) => !s.timeout && s.rt !== null).map((s) => s.rt as number).sort((a, b) => a - b);
  const scored = samples.filter((s) => s.correct !== null);
  const correct = scored.filter((s) => s.correct).length;
  const mean = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
  const median =
    rts.length === 0 ? null : rts.length % 2 === 0 ? (rts[rts.length / 2 - 1] + rts[rts.length / 2]) / 2 : rts[Math.floor(rts.length / 2)];
  const sd = rts.length > 1 && mean !== null ? Math.sqrt(rts.reduce((s, rt) => s + (rt - mean) ** 2, 0) / (rts.length - 1)) : null;
  return {
    n: samples.length,
    participants: new Set(samples.map((s) => s.participantId)).size,
    rtCount: rts.length,
    meanRt: round2(mean),
    medianRt: round2(median),
    sdRt: round2(sd),
    scoredCount: scored.length,
    /** Percentage 0-100 of scored responses that were correct. */
    accuracy: scored.length > 0 ? round2((correct / scored.length) * 100) : null,
    timeouts: samples.filter((s) => s.timeout).length,
  };
}

export class ResultsService {
  static async getAggregateResults(experimentId: string, researcherProfileId: string, versionId?: string) {
    await assertOwner(experimentId, researcherProfileId);

    const versionFilter = versionId ? { versionId } : {};
    const statusCounts = await prisma.experimentSession.groupBy({
      by: ['status'],
      where: { experimentId, ...versionFilter },
      _count: { _all: true },
    });
    const count = (status: string) => statusCounts.find((s) => s.status === status)?._count._all ?? 0;
    const participants = await prisma.experimentSession.findMany({
      where: { experimentId, ...versionFilter },
      distinct: ['participantId'],
      select: { participantId: true },
    });

    const responses = await prisma.trialResponse.findMany({
      where: { excluded: false, session: { experimentId, status: 'COMPLETED', ...versionFilter } },
      select: {
        condition: true,
        reactionTimeMs: true,
        correct: true,
        timeout: true,
        response: true,
        session: { select: { participantId: true } },
        trial: { select: { id: true, trialKey: true, name: true } },
      },
    });

    // Only trials that asked for a response contribute to RT/accuracy statistics.
    const responseTrials = responses.filter((r) => {
      const payload = r.response as unknown as TrialResponsePayload | null;
      return r.reactionTimeMs !== null || r.correct !== null || (payload?.elements?.length ?? 0) > 0 || r.timeout;
    });

    const byCondition = new Map<string, Sample[]>();
    const byTrial = new Map<string, { name: string; condition: string; samples: Sample[] }>();
    for (const r of responseTrials) {
      const sample: Sample = { rt: r.reactionTimeMs, correct: r.correct, timeout: r.timeout, participantId: r.session.participantId };
      const condition = r.condition || 'Unlabeled';
      if (!byCondition.has(condition)) byCondition.set(condition, []);
      byCondition.get(condition)!.push(sample);

      const key = r.trial.trialKey ?? r.trial.id;
      if (!byTrial.has(key)) byTrial.set(key, { name: r.trial.name ?? key, condition, samples: [] });
      byTrial.get(key)!.samples.push(sample);
    }

    return {
      experimentId,
      versionId: versionId ?? null,
      summary: {
        participants: participants.length,
        totalSessions: statusCounts.reduce((s, c) => s + c._count._all, 0),
        completedSessions: count('COMPLETED'),
        inProgressSessions: count('STARTED') + count('IN_PROGRESS'),
        excludedSessions: count('EXCLUDED'),
        abandonedSessions: count('ABANDONED'),
        analyzedResponses: responseTrials.length,
      },
      conditions: Array.from(byCondition.entries())
        .map(([condition, samples]) => ({ condition, ...summarize(samples) }))
        .sort((a, b) => a.condition.localeCompare(b.condition)),
      trials: Array.from(byTrial.entries()).map(([trialKey, t]) => ({ trialKey, name: t.name, condition: t.condition, ...summarize(t.samples) })),
      computedAt: new Date().toISOString(),
    };
  }

  static async listParticipants(experimentId: string, researcherProfileId: string, query: { page?: number; limit?: number; status?: string }) {
    await assertOwner(experimentId, researcherProfileId);
    const pagination = parsePagination(query);
    const where: Prisma.ExperimentSessionWhereInput = { experimentId };
    if (query.status) where.status = query.status as Prisma.ExperimentSessionWhereInput['status'];

    const [sessions, total] = await Promise.all([
      prisma.experimentSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          pseudonymousRef: true,
          status: true,
          startedAt: true,
          completedAt: true,
          qualityStatus: true,
          version: { select: { versionNumber: true } },
          qualitySignals: { select: { signalType: true, severity: true, metadata: true } },
          qualityFlags: { select: { id: true, status: true, reason: true } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.experimentSession.count({ where }),
    ]);
    return paginatedResult(sessions, total, pagination);
  }

  /** Trial-level rows for the raw data table. */
  static async getRawData(
    experimentId: string,
    researcherProfileId: string,
    options: { includeExcluded: boolean; versionId?: string; limit: number; offset: number }
  ) {
    await assertOwner(experimentId, researcherProfileId);
    const where: Prisma.TrialResponseWhereInput = {
      session: {
        experimentId,
        ...(options.versionId ? { versionId: options.versionId } : {}),
        ...(options.includeExcluded ? {} : { status: { not: 'EXCLUDED' } }),
      },
      ...(options.includeExcluded ? {} : { excluded: false }),
    };

    const [rows, total] = await Promise.all([
      prisma.trialResponse.findMany({
        where,
        include: {
          session: { select: { pseudonymousRef: true, status: true, version: { select: { versionNumber: true } } } },
          trial: { select: { id: true, trialKey: true, name: true } },
        },
        orderBy: [{ session: { startedAt: 'asc' } }, { sessionId: 'asc' }, { trialSequence: 'asc' }],
        take: options.limit,
        skip: options.offset,
      }),
      prisma.trialResponse.count({ where }),
    ]);

    return {
      total,
      limit: options.limit,
      offset: options.offset,
      data: rows.map((r) => {
        const payload = r.response as unknown as TrialResponsePayload | null;
        return {
          id: r.id,
          participant: r.session.pseudonymousRef,
          sessionId: r.sessionId,
          sessionStatus: r.session.status,
          versionNumber: r.session.version.versionNumber,
          trialKey: r.trial.trialKey ?? r.trial.id,
          trialName: r.trial.name,
          trialSequence: r.trialSequence,
          condition: r.condition,
          advanceReason: payload?.advanceReason ?? null,
          responses: (payload?.elements ?? []).map((e) => ({ elementId: e.elementId, type: e.type, display: e.display, rtMs: e.rtMs, correct: e.correct ?? null })),
          reactionTimeMs: r.reactionTimeMs,
          correct: r.correct,
          timeout: r.timeout,
          excluded: r.excluded,
          exclusionReason: r.exclusionReason,
        };
      }),
    };
  }
}
