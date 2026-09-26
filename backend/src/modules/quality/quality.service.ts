// ==============================================================================
// SynapseLab — Quality Service
// ==============================================================================
// Researcher quality flags, participant rating history and data exclusion.

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AUDIT_ACTIONS, QUALITY_FLAG_STATUS, RATING, RATING_REASONS } from '../../config/constants';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import { applyRatingChange } from './rating.service';

export interface CreateQualityFlagInput {
  sessionId: string;
  reason: string;
  description: string;
  affectedTrials?: string[];
  evidence?: Record<string, unknown>;
}

export interface ReviewFlagInput {
  status: 'CONFIRMED' | 'DISMISSED';
  /** Positive number of rating points to deduct; only applied when CONFIRMED. */
  ratingPenalty?: number;
  note?: string;
}

export interface ExcludeDataInput {
  sessionId: string;
  responseIds?: string[];
  reason: string;
}

async function ownedSession(sessionId: string, researcherProfileId: string) {
  const session = await prisma.experimentSession.findUnique({
    where: { id: sessionId },
    include: { experiment: { select: { id: true, researcherId: true } } },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');
  return session;
}

export class QualityService {
  /**
   * Flags a session. The participant is taken from the session itself, so a researcher
   * can only flag people who took part in their own experiment. A flag has no effect
   * on the rating until it is reviewed and confirmed.
   */
  static async createFlag(researcherProfileId: string, input: CreateQualityFlagInput, actorId: string) {
    const session = await ownedSession(input.sessionId, researcherProfileId);
    const open = await prisma.qualityFlag.count({ where: { sessionId: session.id, status: QUALITY_FLAG_STATUS.OPEN } });
    if (open > 0) throw new ConflictError('This session already has an open flag. Review it first.');

    const flag = await prisma.qualityFlag.create({
      data: {
        participantId: session.participantId,
        experimentId: session.experimentId,
        sessionId: session.id,
        researcherId: researcherProfileId,
        reason: input.reason,
        description: input.description,
        affectedTrials: input.affectedTrials as Prisma.InputJsonValue | undefined,
        evidence: input.evidence as Prisma.InputJsonValue | undefined,
        status: QUALITY_FLAG_STATUS.OPEN,
      },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.QUALITY_FLAG_CREATED,
      resourceType: 'QUALITY_FLAG',
      resourceId: flag.id,
      metadata: { sessionId: session.id, experimentId: session.experimentId, reason: input.reason },
    });
    return this.flagView(flag, session.pseudonymousRef);
  }

  /** Confirms or dismisses an open flag exactly once. */
  static async reviewFlag(flagId: string, researcherProfileId: string, input: ReviewFlagInput, actorId: string) {
    const flag = await prisma.qualityFlag.findUnique({ where: { id: flagId }, include: { experiment: { select: { researcherId: true } } } });
    if (!flag) throw new NotFoundError('Quality flag not found');
    if (flag.experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');

    const penalty = input.status === 'CONFIRMED' ? input.ratingPenalty ?? 0 : 0;
    if (input.status === 'DISMISSED' && input.ratingPenalty) {
      throw new ValidationError('A dismissed flag cannot change the participant rating.');
    }
    if (penalty < 0 || penalty > RATING.MAX_RESEARCHER_PENALTY) {
      throw new ValidationError(`Rating penalty must be between 0 and ${RATING.MAX_RESEARCHER_PENALTY}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const transitioned = await tx.qualityFlag.updateMany({
        where: { id: flagId, status: QUALITY_FLAG_STATUS.OPEN },
        data: { status: input.status, reviewedAt: new Date(), reviewedBy: actorId },
      });
      if (transitioned.count === 0) throw new ConflictError('This flag has already been reviewed.');

      if (penalty > 0) {
        await applyRatingChange(tx, {
          participantId: flag.participantId,
          delta: -penalty,
          reason: RATING_REASONS.RESEARCHER_QUALITY_FLAG,
          source: 'RESEARCHER',
          experimentId: flag.experimentId,
          sessionId: flag.sessionId,
          metadata: { flagId, flagReason: flag.reason, note: input.note ?? null, reviewedBy: actorId },
        });
      }
      return tx.qualityFlag.findUniqueOrThrow({ where: { id: flagId } });
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.QUALITY_FLAG_REVIEWED,
      resourceType: 'QUALITY_FLAG',
      resourceId: flagId,
      metadata: { status: input.status, ratingPenalty: penalty, note: input.note ?? null },
    });
    return this.flagView(updated, null);
  }

  static async listFlags(experimentId: string, researcherProfileId: string, query: { status?: string; page?: number; limit?: number }) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');

    const pagination = parsePagination(query);
    const where: Prisma.QualityFlagWhereInput = { experimentId };
    if (query.status) where.status = query.status as Prisma.QualityFlagWhereInput['status'];

    const [flags, total] = await Promise.all([
      prisma.qualityFlag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { session: { select: { pseudonymousRef: true } } },
      }),
      prisma.qualityFlag.count({ where }),
    ]);
    return paginatedResult(flags.map((f) => this.flagView(f, f.session?.pseudonymousRef ?? null)), total, pagination);
  }

  /** Researchers see the pseudonym, never the internal participant profile id. */
  private static flagView<T extends { participantId: string }>(flag: T, pseudonym: string | null) {
    const { participantId: _internal, ...rest } = flag;
    return { ...rest, participant: pseudonym };
  }

  static async getParticipantRating(participantProfileId: string) {
    const participant = await prisma.participantProfile.findUnique({
      where: { id: participantProfileId },
      select: { qualityRating: true, totalRewardPoints: true, completedSessionsCount: true },
    });
    if (!participant) throw new NotFoundError('Participant not found');

    const events = await prisma.participantRatingEvent.findMany({
      where: { participantId: participantProfileId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const experimentIds = Array.from(new Set(events.map((e) => e.experimentId).filter((id): id is string => !!id)));
    const titles = new Map(
      (await prisma.experiment.findMany({ where: { id: { in: experimentIds } }, select: { id: true, title: true } })).map((e) => [e.id, e.title])
    );

    return {
      currentRating: participant.qualityRating,
      totalRewardPoints: participant.totalRewardPoints,
      completedSessionsCount: participant.completedSessionsCount,
      bounds: { min: RATING.MIN, max: RATING.MAX, default: RATING.DEFAULT },
      history: events.map((e) => ({
        id: e.id,
        oldRating: e.oldRating,
        delta: e.delta,
        newRating: e.newRating,
        reason: e.reason,
        source: e.source,
        experimentId: e.experimentId,
        experimentTitle: e.experimentId ? titles.get(e.experimentId) ?? null : null,
        createdAt: e.createdAt,
      })),
    };
  }

  /** Marks data as excluded from analysis without deleting it. */
  static async excludeData(researcherProfileId: string, input: ExcludeDataInput, actorId: string) {
    const session = await ownedSession(input.sessionId, researcherProfileId);
    const exclusion = { excluded: true, exclusionReason: input.reason, excludedAt: new Date(), excludedBy: actorId };

    let affected: number;
    if (input.responseIds && input.responseIds.length > 0) {
      const result = await prisma.trialResponse.updateMany({ where: { id: { in: input.responseIds }, sessionId: session.id }, data: exclusion });
      if (result.count !== input.responseIds.length) {
        throw new ValidationError('Some response ids do not belong to this session.');
      }
      affected = result.count;
    } else {
      const [, result] = await prisma.$transaction([
        prisma.experimentSession.update({ where: { id: session.id }, data: { status: 'EXCLUDED', qualityStatus: 'EXCLUDED' } }),
        prisma.trialResponse.updateMany({ where: { sessionId: session.id }, data: exclusion }),
      ]);
      affected = result.count;
    }

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.DATA_EXCLUDED,
      resourceType: 'SESSION',
      resourceId: session.id,
      metadata: { reason: input.reason, responseIds: input.responseIds ?? null, fullSession: !input.responseIds?.length, affected },
    });
    return { message: 'Data excluded', affectedResponses: affected };
  }
}
