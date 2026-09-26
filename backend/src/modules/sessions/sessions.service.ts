// ==============================================================================
// SynapseLab — Sessions Service
// ==============================================================================
// Session start/resume, trial-response ingestion (validated and scored on the
// server against the session's own immutable version) and completion (reward,
// automatic quality rules, rating changes).

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AUDIT_ACTIONS, EXPERIMENT_STATUS, RATING_REASONS, SESSION_STATUS } from '../../config/constants';
import {
  ConflictError,
  ExperimentStateError,
  ForbiddenError,
  NotEligibleError,
  NotFoundError,
  SessionIncompleteError,
  ValidationError,
} from '../../common/errors/app-error';
import { AuditService } from '../audit/audit.service';
import { ExperimentService } from '../experiments/experiments.service';
import { VersionService } from '../experiment-versions/versions.service';
import { evaluateSessionQuality, resolveQualityRules, type RecordedTrial } from '../quality/quality-rules';
import { applyRatingChange, type AppliedRatingChange } from '../quality/rating.service';
import {
  coerceResponseValue,
  computeTrialOrder,
  definitionFromSnapshot,
  redactForParticipant,
  requiredResponsesSatisfied,
  scoreTrial,
  trialHasTimer,
  trialUsesSubmit,
  type AdvanceReason,
  type ElementResponse,
  type ExperimentDefinition,
  type ResponseValue,
  type TrialResponsePayload,
} from '../../shared/experiment';

export interface IncomingEvent {
  eventId: string;
  trialId: string;
  trialSequence: number;
  stimulusDisplayTimestamp?: number;
  responseTimestamp?: number;
  reactionTimeMs?: number | null;
  response: { advanceReason: AdvanceReason; elements: Array<{ elementId: string; value: unknown; rtMs: number }> };
  clientEventSequence?: number;
}

const MAX_RT_MS = 24 * 60 * 60 * 1000;
const ADVANCE_REASONS: readonly AdvanceReason[] = ['response', 'submit', 'continue', 'timeout'];

function sessionView(session: { id: string; experimentId: string; versionId: string; status: string; startedAt: Date; completedAt: Date | null }) {
  return {
    id: session.id,
    experimentId: session.experimentId,
    versionId: session.versionId,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
  };
}

async function loadVersion(versionId: string) {
  const version = await prisma.experimentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, versionNumber: true, configSnapshot: true, trials: { select: { id: true, trialKey: true } } },
  });
  if (!version) throw new NotFoundError('Experiment version not found');
  const definition = definitionFromSnapshot(version.configSnapshot);
  // Versions published before trialKey existed used the builder id as the row id.
  const trialRowByKey = new Map(version.trials.map((t) => [t.trialKey ?? t.id, t.id]));
  return { version, definition, trialRowByKey };
}

async function recordedTrialKeys(sessionId: string): Promise<string[]> {
  const rows = await prisma.trialResponse.findMany({
    where: { sessionId },
    select: { trial: { select: { id: true, trialKey: true } } },
  });
  return rows.map((r) => r.trial.trialKey ?? r.trial.id);
}

export class SessionService {
  /**
   * Starts a session, or resumes the participant's session for the same idempotency
   * key (e.g. after a page reload). Idempotency keys are scoped to the participant
   * and experiment, so one participant can never retrieve another's session.
   */
  static async startSession(
    experimentId: string,
    participantProfileId: string,
    input: { consentId?: string; clientMetadata?: Record<string, unknown>; idempotencyKey?: string },
    actorId: string
  ) {
    const scopedKey = input.idempotencyKey ? `${participantProfileId}:${experimentId}:${input.idempotencyKey}` : null;
    if (scopedKey) {
      const existing = await prisma.experimentSession.findUnique({ where: { idempotencyKey: scopedKey } });
      if (existing) return this.buildStartResponse(existing, true);
    }

    const eligibility = await ExperimentService.checkEligibility(experimentId, participantProfileId);
    if (!eligibility.eligible) throw new NotEligibleError(eligibility.reason);

    if (input.consentId) {
      const consent = await prisma.participantConsent.findUnique({ where: { id: input.consentId } });
      if (!consent || consent.participantId !== participantProfileId || consent.experimentId !== experimentId || consent.withdrawnAt) {
        throw new ValidationError('Consent record is not valid for this experiment.');
      }
    }

    const version = await VersionService.getLatestPublished(experimentId);
    const participant = await prisma.participantProfile.findUnique({ where: { id: participantProfileId } });
    if (!participant) throw new NotFoundError('Participant not found');

    const session = await prisma.$transaction(async (tx) => {
      // Serialize starts per participant+experiment; otherwise two parallel requests
      // could both pass the attempt check under READ COMMITTED isolation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`session:${participantProfileId}:${experimentId}`}))`;

      if (scopedKey) {
        const existing = await tx.experimentSession.findUnique({ where: { idempotencyKey: scopedKey } });
        if (existing) return existing;
      }

      const experiment = await tx.experiment.findUnique({ where: { id: experimentId } });
      if (!experiment || experiment.status !== EXPERIMENT_STATUS.PUBLISHED) {
        throw new ExperimentStateError('Experiment is not accepting participants');
      }
      const attempts = await ExperimentService.attemptSummary(experiment, participantProfileId, tx);
      if (!attempts.canStartNew) throw new ConflictError(attempts.reason || 'Attempt limit reached');

      return tx.experimentSession.create({
        data: {
          experimentId,
          versionId: version.id,
          participantId: participantProfileId,
          pseudonymousRef: participant.pseudonymousId,
          consentId: input.consentId,
          status: SESSION_STATUS.STARTED,
          clientMetadata: input.clientMetadata as Prisma.InputJsonValue | undefined,
          idempotencyKey: scopedKey,
        },
      });
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.SESSION_STARTED,
      resourceType: 'SESSION',
      resourceId: session.id,
      metadata: { experimentId, versionId: session.versionId },
    });

    return this.buildStartResponse(session, false);
  }

  /** Everything the runner needs: the session, its version (answers removed) and progress. */
  private static async buildStartResponse(
    session: { id: string; experimentId: string; versionId: string; status: string; startedAt: Date; completedAt: Date | null },
    resumed: boolean
  ) {
    const { version, definition } = await loadVersion(session.versionId);
    return {
      session: sessionView(session),
      resumed,
      version: { id: version.id, versionNumber: version.versionNumber, definition: redactForParticipant(definition) },
      progress: { recordedTrialIds: await recordedTrialKeys(session.id) },
    };
  }

  /**
   * Ingests trial responses. Every event is checked against the session's version:
   * the trial must exist and be presented at the expected position, each element
   * value must be valid for that element, and correctness is computed here - the
   * client never supplies it. Duplicate eventIds and already-recorded trials are
   * skipped, so retries are safe.
   */
  static async ingestEvents(sessionId: string, events: IncomingEvent[], participantProfileId: string, actorId: string) {
    const session = await prisma.experimentSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError('Session not found');
    if (session.participantId !== participantProfileId) throw new ForbiddenError('This is not your session');
    if (session.status !== SESSION_STATUS.STARTED && session.status !== SESSION_STATUS.IN_PROGRESS) {
      throw new ExperimentStateError('Session is no longer accepting responses');
    }

    const { definition, trialRowByKey } = await loadVersion(session.versionId);
    const order = computeTrialOrder(definition, session.id);

    const existingEventIds = new Set(
      (await prisma.trialResponse.findMany({ where: { eventId: { in: events.map((e) => e.eventId) } }, select: { eventId: true } })).map((r) => r.eventId)
    );
    const alreadyRecorded = new Set(await recordedTrialKeys(sessionId));

    const rows: Prisma.TrialResponseCreateManyInput[] = [];
    let duplicates = 0;
    for (const [i, event] of events.entries()) {
      if (existingEventIds.has(event.eventId) || alreadyRecorded.has(event.trialId)) {
        duplicates += 1;
        continue;
      }
      rows.push(this.buildResponseRow(sessionId, event, i, definition, order, trialRowByKey));
      alreadyRecorded.add(event.trialId);
    }

    let ingested = 0;
    if (rows.length > 0) {
      const created = await prisma.trialResponse.createMany({ data: rows, skipDuplicates: true });
      ingested = created.count;
      duplicates += rows.length - created.count;
      await prisma.experimentSession.updateMany({
        where: { id: sessionId, status: SESSION_STATUS.STARTED },
        data: { status: SESSION_STATUS.IN_PROGRESS },
      });
      await AuditService.record({
        actorId,
        action: AUDIT_ACTIONS.EVENTS_INGESTED,
        resourceType: 'SESSION',
        resourceId: sessionId,
        metadata: { ingested, duplicates },
      });
    }

    return { ingested, duplicates, total: events.length };
  }

  private static buildResponseRow(
    sessionId: string,
    event: IncomingEvent,
    index: number,
    definition: ExperimentDefinition,
    order: number[],
    trialRowByKey: Map<string, string>
  ): Prisma.TrialResponseCreateManyInput {
    const where = `events[${index}]`;
    const trialIndex = definition.trials.findIndex((t) => t.id === event.trialId);
    const trialRowId = trialRowByKey.get(event.trialId);
    if (trialIndex === -1 || !trialRowId) throw new ValidationError(`${where}: unknown trial ${event.trialId}`);
    const trial = definition.trials[trialIndex];

    const expectedSequence = order.indexOf(trialIndex);
    if (event.trialSequence !== expectedSequence) {
      throw new ValidationError(`${where}: trial ${event.trialId} is presented at position ${expectedSequence}, not ${event.trialSequence}`);
    }
    const reasonAllowed: Record<AdvanceReason, boolean> = {
      timeout: trialHasTimer(trial),
      continue: trial.advanceMode === 'manual',
      submit: trialUsesSubmit(trial),
      response: (trial.advanceMode === 'response' || trial.advanceMode === 'response_or_timeout') && !trialUsesSubmit(trial),
    };
    if (!ADVANCE_REASONS.includes(event.response.advanceReason) || !reasonAllowed[event.response.advanceReason]) {
      throw new ValidationError(`${where}: advanceReason "${String(event.response.advanceReason)}" is not possible for this trial`);
    }

    const values = new Map<string, ResponseValue>();
    const elements: ElementResponse[] = [];
    for (const [j, raw] of event.response.elements.entries()) {
      const element = trial.elements.find((e) => e.id === raw.elementId);
      if (!element || element.role !== 'RESPONSE') {
        throw new ValidationError(`${where}.elements[${j}]: element ${raw.elementId} is not a response element of this trial`);
      }
      if (values.has(element.id)) throw new ValidationError(`${where}.elements[${j}]: duplicate response for element ${element.id}`);
      if (!Number.isFinite(raw.rtMs) || raw.rtMs < 0 || raw.rtMs > MAX_RT_MS) {
        throw new ValidationError(`${where}.elements[${j}]: invalid rtMs`);
      }
      const coerced = coerceResponseValue(element, raw.value);
      if (!coerced.ok) throw new ValidationError(`${where}.elements[${j}]: ${coerced.error}`);
      values.set(element.id, coerced.value);
      elements.push({ elementId: element.id, type: element.type, value: coerced.value, display: coerced.display, rtMs: raw.rtMs });
    }

    const reason = event.response.advanceReason;
    const timedOut = reason === 'timeout';
    // Only a timeout (or a timed trial) may end a trial with required responses missing.
    if (!timedOut && trial.advanceMode !== 'timed' && !requiredResponsesSatisfied(trial, new Set(values.keys()))) {
      throw new ValidationError(`${where}: required responses are missing for trial ${trial.id}`);
    }

    const score = scoreTrial(trial, values);
    for (const e of elements) e.correct = score.byElement[e.elementId] ?? null;
    const payload: TrialResponsePayload = { advanceReason: reason, elements };

    const rt = event.reactionTimeMs;
    if (rt !== undefined && rt !== null && (!Number.isFinite(rt) || rt < 0 || rt > MAX_RT_MS)) {
      throw new ValidationError(`${where}: invalid reactionTimeMs`);
    }

    return {
      sessionId,
      trialId: trialRowId,
      eventId: event.eventId,
      trialSequence: event.trialSequence,
      condition: trial.condition || null,
      stimulusDisplayTimestamp: event.stimulusDisplayTimestamp !== undefined ? BigInt(Math.round(event.stimulusDisplayTimestamp)) : null,
      responseTimestamp: event.responseTimestamp !== undefined ? BigInt(Math.round(event.responseTimestamp)) : null,
      reactionTimeMs: rt ?? null,
      response: payload as unknown as Prisma.InputJsonValue,
      correct: score.correct,
      timeout: timedOut,
      clientEventSequence: event.clientEventSequence,
    };
  }

  /**
   * Completes a session once every trial of its version has been recorded, then
   * awards the reward and applies rating changes exactly once. Calling it again
   * returns the stored outcome.
   */
  static async completeSession(sessionId: string, participantProfileId: string, actorId: string) {
    const session = await prisma.experimentSession.findUnique({ where: { id: sessionId }, include: { experiment: true } });
    if (!session) throw new NotFoundError('Session not found');
    if (session.participantId !== participantProfileId) throw new ForbiddenError('This is not your session');
    if (session.status === SESSION_STATUS.COMPLETED) return this.completionOutcome(sessionId);
    if (session.status !== SESSION_STATUS.STARTED && session.status !== SESSION_STATUS.IN_PROGRESS) {
      throw new ExperimentStateError('This session can no longer be completed');
    }

    const { definition } = await loadVersion(session.versionId);
    const responses = await prisma.trialResponse.findMany({
      where: { sessionId },
      select: { trialSequence: true, reactionTimeMs: true, timeout: true, response: true, trial: { select: { id: true, trialKey: true } } },
    });
    const recorded = new Set(responses.map((r) => r.trial.trialKey ?? r.trial.id));
    const missing = definition.trials.filter((t) => !recorded.has(t.id)).length;
    if (missing > 0) throw new SessionIncompleteError({ missingTrials: missing });

    const rules = resolveQualityRules(session.experiment.qualityRules);
    const recordedTrials: RecordedTrial[] = responses.map((r) => ({
      trialKey: r.trial.trialKey ?? r.trial.id,
      trialSequence: r.trialSequence,
      reactionTimeMs: r.reactionTimeMs,
      timeout: r.timeout,
      response: (r.response as unknown as TrialResponsePayload | null) ?? null,
    }));
    const findings = evaluateSessionQuality(definition, recordedTrials, rules);
    const rewardPoints = session.experiment.rewardPoints;

    const completedNow = await prisma.$transaction(async (tx) => {
      const transitioned = await tx.experimentSession.updateMany({
        where: { id: sessionId, status: { in: [SESSION_STATUS.STARTED, SESSION_STATUS.IN_PROGRESS] } },
        data: { status: SESSION_STATUS.COMPLETED, completedAt: new Date(), qualityStatus: findings.length > 0 ? 'FLAGGED' : 'CLEAN' },
      });
      // Another request completed it first; that request applied reward and rating.
      if (transitioned.count === 0) return false;

      await tx.participantProfile.update({
        where: { id: participantProfileId },
        data: { completedSessionsCount: { increment: 1 }, ...(rewardPoints > 0 ? { totalRewardPoints: { increment: rewardPoints } } : {}) },
      });
      if (rewardPoints > 0) {
        await tx.experimentReward.create({
          data: {
            participantId: participantProfileId,
            experimentId: session.experimentId,
            sessionId,
            points: rewardPoints,
            reason: 'EXPERIMENT_COMPLETION',
            idempotencyKey: `reward:${sessionId}:completion`,
          },
        });
      }

      if (findings.length > 0) {
        await tx.qualitySignal.createMany({
          data: findings.map((f) => ({ sessionId, signalType: f.signalType, severity: f.severity, metadata: f.metadata as Prisma.InputJsonValue })),
        });
      }

      // Clean completions raise the rating by the experiment's reward; each triggered
      // quality rule applies its configured penalty instead.
      if (findings.length === 0 && rewardPoints > 0) {
        await applyRatingChange(tx, {
          participantId: participantProfileId,
          delta: rewardPoints,
          reason: RATING_REASONS.EXPERIMENT_COMPLETION,
          source: 'SYSTEM',
          experimentId: session.experimentId,
          sessionId,
          metadata: { rewardPoints },
        });
      }
      for (const f of findings) {
        if (f.penalty <= 0) continue;
        await applyRatingChange(tx, {
          participantId: participantProfileId,
          delta: -f.penalty,
          reason: f.signalType === 'EXTREMELY_FAST_RESPONSES'
            ? RATING_REASONS.EXTREMELY_FAST_RESPONSE
            : f.signalType === 'REPEATED_IDENTICAL_RESPONSES'
              ? RATING_REASONS.REPEATED_IDENTICAL_RESPONSES
              : RATING_REASONS.SKIPPED_REQUIRED_QUESTIONS,
          source: 'SYSTEM',
          experimentId: session.experimentId,
          sessionId,
          metadata: f.metadata,
        });
      }
      return true;
    });

    if (completedNow) {
      await AuditService.record({
        actorId,
        action: AUDIT_ACTIONS.SESSION_COMPLETED,
        resourceType: 'SESSION',
        resourceId: sessionId,
        metadata: { experimentId: session.experimentId, signals: findings.map((f) => f.signalType) },
      });
    }
    return this.completionOutcome(sessionId);
  }

  /** The stored result of a completed session, as shown to the participant. */
  private static async completionOutcome(sessionId: string) {
    const [session, reward, ratingEvents, signals, profile] = await Promise.all([
      prisma.experimentSession.findUniqueOrThrow({ where: { id: sessionId } }),
      prisma.experimentReward.findFirst({ where: { sessionId, revokedAt: null } }),
      prisma.participantRatingEvent.findMany({ where: { sessionId, source: 'SYSTEM' }, orderBy: { createdAt: 'asc' } }),
      prisma.qualitySignal.findMany({ where: { sessionId } }),
      prisma.experimentSession.findUniqueOrThrow({ where: { id: sessionId }, select: { participant: { select: { qualityRating: true, totalRewardPoints: true } } } }),
    ]);
    const ratingChanges: AppliedRatingChange[] = ratingEvents.map((e) => ({ oldRating: e.oldRating, newRating: e.newRating, delta: e.delta, reason: e.reason }));
    return {
      session: sessionView(session),
      rewardPoints: reward?.points ?? 0,
      ratingChanges,
      currentRating: profile.participant.qualityRating,
      totalRewardPoints: profile.participant.totalRewardPoints,
      qualityStatus: session.qualityStatus,
      qualitySignals: signals.map((s) => s.signalType),
    };
  }

  static async getSession(sessionId: string, viewer: { role: string; participantProfileId?: string; researcherProfileId?: string }) {
    const session = await prisma.experimentSession.findUnique({
      where: { id: sessionId },
      include: {
        experiment: { select: { researcherId: true, title: true } },
        responses: { orderBy: { trialSequence: 'asc' } },
        qualitySignals: true,
      },
    });
    if (!session) throw new NotFoundError('Session not found');
    const isOwnerParticipant = viewer.role === 'PARTICIPANT' && session.participantId === viewer.participantProfileId;
    const isOwnerResearcher = viewer.role === 'RESEARCHER' && session.experiment.researcherId === viewer.researcherProfileId;
    if (!isOwnerParticipant && !isOwnerResearcher && viewer.role !== 'ADMIN') throw new NotFoundError('Session not found');

    const { participantId: _p, idempotencyKey: _k, clientMetadata: _m, ...rest } = session;
    return {
      ...rest,
      responses: session.responses.map((r) => ({
        ...r,
        stimulusDisplayTimestamp: r.stimulusDisplayTimestamp?.toString() ?? null,
        responseTimestamp: r.responseTimestamp?.toString() ?? null,
      })),
    };
  }

  /** Participant's own session history. */
  static async listMine(participantProfileId: string) {
    const sessions = await prisma.experimentSession.findMany({
      where: { participantId: participantProfileId },
      orderBy: { startedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        experimentId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        qualityStatus: true,
        experiment: { select: { title: true, status: true } },
        rewards: { select: { points: true } },
        _count: { select: { responses: true } },
      },
    });
    return sessions.map((s) => ({
      ...s,
      rewardPoints: s.rewards.reduce((sum, r) => sum + r.points, 0),
      rewards: undefined,
    }));
  }
}
