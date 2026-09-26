// ==============================================================================
// SynapseLab — Sessions Service
// ==============================================================================
// Handles experiment sessions, batch event ingestion, and completion.

import { prisma } from '../../config/database';
import { AUDIT_ACTIONS, SESSION_STATUS, RATING_REASONS, RATING_SOURCES, RATING } from '../../config/constants';
import {
  NotFoundError,
  ForbiddenError,
  NotEligibleError,
  ConflictError,
  ExperimentStateError,
  IdempotencyError,
} from '../../common/errors/app-error';
import { AuditService } from '../audit/audit.service';
import { ExperimentService } from '../experiments/experiments.service';
import { VersionService } from '../experiment-versions/versions.service';
import { logger } from '../../common/utils/logger';

export interface BatchEvent {
  eventId: string;
  trialId: string;
  trialSequence: number;
  condition?: string;
  stimulusId?: string;
  stimulusDisplayTimestamp?: number;
  responseTimestamp?: number;
  reactionTimeMs?: number;
  response?: Record<string, unknown>;
  correct?: boolean;
  timeout?: boolean;
  clientEventSequence?: number;
}

export class SessionService {
  /**
   * Start a new experiment session.
   * Enforces eligibility and attempt limits using transactions.
   */
  static async startSession(
    experimentId: string,
    participantProfileId: string,
    consentId: string | undefined,
    clientMetadata: Record<string, unknown> | undefined,
    idempotencyKey: string | undefined,
    actorId: string
  ) {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await prisma.experimentSession.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    // Server-side eligibility check
    const eligibility = await ExperimentService.checkEligibility(experimentId, participantProfileId);
    if (!eligibility.eligible) {
      throw new NotEligibleError(eligibility.reason);
    }

    // Get the latest published version
    const version = await VersionService.getLatestPublished(experimentId);

    // Get participant for pseudonymous reference
    const participant = await prisma.participantProfile.findUnique({
      where: { id: participantProfileId },
    });
    if (!participant) throw new NotFoundError('Participant not found');

    // Use a transaction to prevent race conditions on attempt limits
    const session = await prisma.$transaction(async (tx) => {
      // Re-check attempts inside transaction for consistency
      const experiment = await tx.experiment.findUnique({
        where: { id: experimentId },
      });

      if (!experiment || experiment.status !== 'PUBLISHED') {
        throw new ExperimentStateError('Experiment is not accepting participants');
      }

      if (experiment.attemptPolicy === 'ALLOW_ONE_ATTEMPT') {
        const existingAttempt = await tx.experimentSession.findFirst({
          where: {
            experimentId,
            participantId: participantProfileId,
            status: { in: ['STARTED', 'IN_PROGRESS', 'COMPLETED'] },
          },
        });
        if (existingAttempt) {
          throw new ConflictError('You have already participated in this experiment');
        }
      } else if (experiment.attemptPolicy === 'ALLOW_MULTIPLE_ATTEMPTS') {
        const completedCount = await tx.experimentSession.count({
          where: {
            experimentId,
            participantId: participantProfileId,
            status: 'COMPLETED',
          },
        });
        if (completedCount >= experiment.maxAttempts) {
          throw new ConflictError('Maximum number of attempts reached');
        }
      }

      return tx.experimentSession.create({
        data: {
          experimentId,
          versionId: version.id,
          participantId: participantProfileId,
          pseudonymousRef: participant.pseudonymousId,
          consentId,
          status: SESSION_STATUS.STARTED,
          clientMetadata: clientMetadata as any,
          idempotencyKey,
        },
      });
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.SESSION_STARTED,
      resourceType: 'SESSION',
      resourceId: session.id,
      metadata: { experimentId, versionId: version.id },
    });

    // Return session with version config for the client
    return {
      session: {
        id: session.id,
        experimentId: session.experimentId,
        versionId: session.versionId,
        status: session.status,
        startedAt: session.startedAt,
      },
      version,
    };
  }

  /**
   * Ingest a batch of trial response events.
   * Supports idempotency via eventId — duplicate events are silently skipped.
   */
  static async ingestEvents(
    sessionId: string,
    events: BatchEvent[],
    participantProfileId: string,
    actorId: string
  ) {
    // Verify session ownership
    const session = await prisma.experimentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundError('Session not found');
    if (session.participantId !== participantProfileId) {
      throw new ForbiddenError('This is not your session');
    }
    if (session.status === 'COMPLETED' || session.status === 'EXCLUDED') {
      throw new ExperimentStateError('Session is no longer accepting events');
    }

    // Update session status to IN_PROGRESS if still STARTED
    if (session.status === 'STARTED') {
      await prisma.experimentSession.update({
        where: { id: sessionId },
        data: { status: SESSION_STATUS.IN_PROGRESS },
      });
    }

    // Collect existing eventIds for deduplication
    const existingEventIds = new Set(
      (
        await prisma.trialResponse.findMany({
          where: {
            sessionId,
            eventId: { in: events.map((e) => e.eventId) },
          },
          select: { eventId: true },
        })
      ).map((r) => r.eventId)
    );

    // Filter out duplicates
    const newEvents = events.filter((e) => !existingEventIds.has(e.eventId));

    if (newEvents.length === 0) {
      return {
        ingested: 0,
        duplicates: events.length,
        total: events.length,
      };
    }

    // Insert new events
    const created = await prisma.trialResponse.createMany({
      data: newEvents.map((event) => ({
        sessionId,
        trialId: event.trialId,
        eventId: event.eventId,
        trialSequence: event.trialSequence,
        condition: event.condition,
        stimulusId: event.stimulusId,
        stimulusDisplayTimestamp: event.stimulusDisplayTimestamp
          ? BigInt(event.stimulusDisplayTimestamp)
          : null,
        responseTimestamp: event.responseTimestamp
          ? BigInt(event.responseTimestamp)
          : null,
        reactionTimeMs: event.reactionTimeMs,
        response: event.response as any,
        correct: event.correct,
        timeout: event.timeout || false,
        clientEventSequence: event.clientEventSequence,
      })),
      skipDuplicates: true,
    });

    // Detect quality signals
    await this.detectQualitySignals(sessionId, newEvents);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EVENTS_INGESTED,
      resourceType: 'SESSION',
      resourceId: sessionId,
      metadata: { eventCount: newEvents.length, duplicates: events.length - newEvents.length },
    });

    return {
      ingested: created.count,
      duplicates: events.length - newEvents.length,
      total: events.length,
    };
  }

  /**
   * Complete a session. Awards reward points and updates rating.
   */
  static async completeSession(
    sessionId: string,
    participantProfileId: string,
    actorId: string
  ) {
    const session = await prisma.experimentSession.findUnique({
      where: { id: sessionId },
      include: { experiment: true },
    });

    if (!session) throw new NotFoundError('Session not found');
    if (session.participantId !== participantProfileId) {
      throw new ForbiddenError('This is not your session');
    }
    if (session.status === 'COMPLETED') {
      return { session, message: 'Session already completed' };
    }

    // Complete session in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark session as completed
      const completedSession = await tx.experimentSession.update({
        where: { id: sessionId },
        data: {
          status: SESSION_STATUS.COMPLETED,
          completedAt: new Date(),
          qualityStatus: 'CLEAN',
        },
      });

      // Award reward points
      const rewardPoints = session.experiment.rewardPoints;
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

        // Update participant total reward points
        await tx.participantProfile.update({
          where: { id: participantProfileId },
          data: {
            totalRewardPoints: { increment: rewardPoints },
            completedSessionsCount: { increment: 1 },
          },
        });
      } else {
        await tx.participantProfile.update({
          where: { id: participantProfileId },
          data: { completedSessionsCount: { increment: 1 } },
        });
      }

      // Create positive rating event for completion
      const participant = await tx.participantProfile.findUnique({
        where: { id: participantProfileId },
      });

      if (participant) {
        const delta = 1.0; // Small positive rating for completion
        const newRating = Math.min(RATING.MAX, participant.qualityRating + delta);

        await tx.participantRatingEvent.create({
          data: {
            participantId: participantProfileId,
            oldRating: participant.qualityRating,
            delta,
            newRating,
            reason: RATING_REASONS.EXPERIMENT_COMPLETION,
            source: RATING_SOURCES.SYSTEM,
            experimentId: session.experimentId,
            sessionId,
          },
        });

        await tx.participantProfile.update({
          where: { id: participantProfileId },
          data: { qualityRating: newRating },
        });
      }

      return completedSession;
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.SESSION_COMPLETED,
      resourceType: 'SESSION',
      resourceId: sessionId,
      metadata: { experimentId: session.experimentId },
    });

    return { session: result, message: 'Session completed successfully' };
  }

  /**
   * Get session details (for participant or researcher).
   */
  static async getSession(sessionId: string) {
    const session = await prisma.experimentSession.findUnique({
      where: { id: sessionId },
      include: {
        responses: { orderBy: { trialSequence: 'asc' } },
        qualitySignals: true,
      },
    });

    if (!session) throw new NotFoundError('Session not found');
    return session;
  }

  /**
   * Detect quality signals from submitted events.
   */
  private static async detectQualitySignals(sessionId: string, events: BatchEvent[]) {
    const signals: Array<{ signalType: string; severity: string; metadata: any }> = [];

    for (const event of events) {
      // Check for extremely fast responses (< 150ms is suspicious)
      if (event.reactionTimeMs !== undefined && event.reactionTimeMs < 150 && !event.timeout) {
        signals.push({
          signalType: 'EXTREMELY_FAST_RESPONSE',
          severity: 'MEDIUM',
          metadata: {
            eventId: event.eventId,
            reactionTimeMs: event.reactionTimeMs,
            trialSequence: event.trialSequence,
          },
        });
      }
    }

    // Check for repeated identical responses
    const responses = events
      .filter((e) => e.response)
      .map((e) => JSON.stringify(e.response));

    if (responses.length >= 5) {
      const allSame = responses.every((r) => r === responses[0]);
      if (allSame) {
        signals.push({
          signalType: 'REPEATED_IDENTICAL_RESPONSES',
          severity: 'HIGH',
          metadata: { count: responses.length, response: responses[0] },
        });
      }
    }

    if (signals.length > 0) {
      await prisma.qualitySignal.createMany({
        data: signals.map((s) => ({
          sessionId,
          signalType: s.signalType,
          severity: s.severity,
          metadata: s.metadata,
        })),
      });
    }
  }
}
