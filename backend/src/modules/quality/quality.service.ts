// ==============================================================================
// SynapseLab — Quality Service
// ==============================================================================
// Handles quality flags, rating events, and exclusions.

import { prisma } from '../../config/database';
import { AUDIT_ACTIONS, QUALITY_FLAG_STATUS, RATING, RATING_REASONS, RATING_SOURCES } from '../../config/constants';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/errors/app-error';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';

export interface CreateQualityFlagInput {
  participantId: string;
  experimentId: string;
  sessionId?: string;
  reason: string;
  description?: string;
  affectedTrials?: string[];
  evidence?: Record<string, unknown>;
}

export interface ReviewFlagInput {
  status: 'REVIEWED' | 'DISMISSED' | 'CONFIRMED';
  ratingDelta?: number;
}

export interface ExcludeDataInput {
  sessionId: string;
  responseIds?: string[];
  reason: string;
}

export class QualityService {
  // ===========================================================================
  // QUALITY FLAGS
  // ===========================================================================

  /**
   * Create a quality flag (researcher flags participant/session).
   */
  static async createFlag(
    researcherProfileId: string,
    input: CreateQualityFlagInput,
    actorId: string
  ) {
    // Verify the researcher owns the experiment
    const experiment = await prisma.experiment.findUnique({
      where: { id: input.experimentId },
    });

    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    const flag = await prisma.qualityFlag.create({
      data: {
        participantId: input.participantId,
        experimentId: input.experimentId,
        sessionId: input.sessionId,
        researcherId: researcherProfileId,
        reason: input.reason,
        description: input.description,
        affectedTrials: input.affectedTrials as any,
        evidence: input.evidence as any,
        status: QUALITY_FLAG_STATUS.OPEN,
      },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.QUALITY_FLAG_CREATED,
      resourceType: 'QUALITY_FLAG',
      resourceId: flag.id,
      metadata: { participantId: input.participantId, experimentId: input.experimentId, reason: input.reason },
    });

    return flag;
  }

  /**
   * Review a quality flag (confirm, dismiss, or mark as reviewed).
   * Optionally applies a rating delta if confirmed.
   */
  static async reviewFlag(
    flagId: string,
    researcherProfileId: string,
    input: ReviewFlagInput,
    actorId: string
  ) {
    const flag = await prisma.qualityFlag.findUnique({
      where: { id: flagId },
    });

    if (!flag) throw new NotFoundError('Quality flag not found');

    // Verify the researcher owns the experiment
    const experiment = await prisma.experiment.findUnique({
      where: { id: flag.experimentId },
    });

    if (!experiment || experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedFlag = await tx.qualityFlag.update({
        where: { id: flagId },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewedBy: actorId,
        },
      });

      // Apply rating delta only for CONFIRMED flags
      if (input.status === 'CONFIRMED' && input.ratingDelta) {
        const participant = await tx.participantProfile.findUnique({
          where: { id: flag.participantId },
        });

        if (participant) {
          const newRating = Math.max(
            RATING.MIN,
            Math.min(RATING.MAX, participant.qualityRating + input.ratingDelta)
          );

          await tx.participantRatingEvent.create({
            data: {
              participantId: flag.participantId,
              oldRating: participant.qualityRating,
              delta: input.ratingDelta,
              newRating,
              reason: RATING_REASONS.RESEARCHER_QUALITY_FLAG,
              source: RATING_SOURCES.RESEARCHER,
              experimentId: flag.experimentId,
              sessionId: flag.sessionId,
            },
          });

          await tx.participantProfile.update({
            where: { id: flag.participantId },
            data: { qualityRating: newRating },
          });
        }
      }

      return updatedFlag;
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.QUALITY_FLAG_REVIEWED,
      resourceType: 'QUALITY_FLAG',
      resourceId: flagId,
      metadata: { status: input.status, ratingDelta: input.ratingDelta },
    });

    return updated;
  }

  /**
   * List quality flags for an experiment.
   */
  static async listFlags(experimentId: string, researcherProfileId: string, query: { status?: string; page?: number; limit?: number }) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    const pagination = parsePagination(query);
    const where: any = { experimentId };
    if (query.status) where.status = query.status;

    const [flags, total] = await Promise.all([
      prisma.qualityFlag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.qualityFlag.count({ where }),
    ]);

    return paginatedResult(flags, total, pagination);
  }

  // ===========================================================================
  // PARTICIPANT RATING
  // ===========================================================================

  /**
   * Get participant's current rating and history.
   */
  static async getParticipantRating(participantProfileId: string) {
    const participant = await prisma.participantProfile.findUnique({
      where: { id: participantProfileId },
      select: {
        qualityRating: true,
        totalRewardPoints: true,
        completedSessionsCount: true,
      },
    });

    if (!participant) throw new NotFoundError('Participant not found');

    const ratingHistory = await prisma.participantRatingEvent.findMany({
      where: { participantId: participantProfileId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      current: participant,
      history: ratingHistory,
    };
  }

  // ===========================================================================
  // DATA EXCLUSION
  // ===========================================================================

  /**
   * Exclude data (mark responses/sessions as excluded without deleting).
   */
  static async excludeData(
    researcherProfileId: string,
    input: ExcludeDataInput,
    actorId: string
  ) {
    const session = await prisma.experimentSession.findUnique({
      where: { id: input.sessionId },
      include: { experiment: true },
    });

    if (!session) throw new NotFoundError('Session not found');
    if (session.experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    if (input.responseIds && input.responseIds.length > 0) {
      // Exclude specific responses
      await prisma.trialResponse.updateMany({
        where: {
          id: { in: input.responseIds },
          sessionId: input.sessionId,
        },
        data: {
          excluded: true,
          exclusionReason: input.reason,
          excludedAt: new Date(),
          excludedBy: actorId,
        },
      });
    } else {
      // Exclude entire session
      await prisma.experimentSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'EXCLUDED',
          qualityStatus: 'EXCLUDED',
        },
      });

      await prisma.trialResponse.updateMany({
        where: { sessionId: input.sessionId },
        data: {
          excluded: true,
          exclusionReason: input.reason,
          excludedAt: new Date(),
          excludedBy: actorId,
        },
      });
    }

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.DATA_EXCLUDED,
      resourceType: 'SESSION',
      resourceId: input.sessionId,
      metadata: {
        reason: input.reason,
        responseIds: input.responseIds,
        fullSession: !input.responseIds || input.responseIds.length === 0,
      },
    });

    return { message: 'Data excluded successfully' };
  }
}
