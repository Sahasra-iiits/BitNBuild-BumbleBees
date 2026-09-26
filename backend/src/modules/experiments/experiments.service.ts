// ==============================================================================
// SynapseLab — Experiment Service
// ==============================================================================

import { prisma } from '../../config/database';
import { cacheDelete, cacheDeletePattern, cacheGet, cacheSet } from '../../config/redis';
import { AUDIT_ACTIONS, EXPERIMENT_STATUS } from '../../config/constants';
import {
  ConflictError,
  ExperimentStateError,
  ForbiddenError,
  NotFoundError,
  NotEligibleError,
} from '../../common/errors/app-error';
import { computeConfigHash } from '../../common/utils/crypto';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import type { CreateExperimentInput, UpdateExperimentInput } from './experiments.schema';

export class ExperimentService {
  // ===========================================================================
  // CREATE
  // ===========================================================================
  static async create(researcherProfileId: string, input: CreateExperimentInput, actorId: string) {
    const experiment = await prisma.experiment.create({
      data: {
        researcherId: researcherProfileId,
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        visibility: input.visibility,
        rewardPoints: input.rewardPoints,
        attemptPolicy: input.attemptPolicy,
        maxAttempts: input.maxAttempts,
        eligibilityRules: input.eligibilityRules
          ? {
              create: input.eligibilityRules.map((rule) => ({
                ruleType: rule.ruleType,
                minAge: rule.minAge,
                maxAge: rule.maxAge,
                minRating: rule.minRating,
                maxRating: rule.maxRating,
                maxAttempts: rule.maxAttempts,
                availabilityStart: rule.availabilityStart ? new Date(rule.availabilityStart) : undefined,
                availabilityEnd: rule.availabilityEnd ? new Date(rule.availabilityEnd) : undefined,
                configuration: rule.configuration as any,
              })),
            }
          : undefined,
      },
      include: {
        eligibilityRules: true,
        versions: true,
      },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_CREATED,
      resourceType: 'EXPERIMENT',
      resourceId: experiment.id,
      metadata: { title: experiment.title },
    });

    return experiment;
  }

  // ===========================================================================
  // READ (researcher's own experiments)
  // ===========================================================================
  static async listByResearcher(
    researcherProfileId: string,
    query: { page?: number; limit?: number; status?: string }
  ) {
    const pagination = parsePagination(query);
    const where: any = { researcherId: researcherProfileId };
    if (query.status) where.status = query.status;

    const [experiments, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          _count: { select: { sessions: true, versions: true } },
          eligibilityRules: true,
        },
      }),
      prisma.experiment.count({ where }),
    ]);

    return paginatedResult(experiments, total, pagination);
  }

  // ===========================================================================
  // READ (single experiment with ownership check)
  // ===========================================================================
  static async getById(experimentId: string, researcherProfileId?: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: {
        eligibilityRules: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
        },
        _count: { select: { sessions: true } },
      },
    });

    if (!experiment) {
      throw new NotFoundError('Experiment not found');
    }

    // If researcherProfileId is provided, verify ownership
    if (researcherProfileId && experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    return experiment;
  }

  // ===========================================================================
  // UPDATE (draft only)
  // ===========================================================================
  static async update(experimentId: string, researcherProfileId: string, input: UpdateExperimentInput, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.DRAFT) {
      throw new ExperimentStateError('Only draft experiments can be directly edited. Create a new version for published experiments.');
    }

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: {
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        visibility: input.visibility,
        rewardPoints: input.rewardPoints,
        attemptPolicy: input.attemptPolicy,
        maxAttempts: input.maxAttempts,
      },
      include: { eligibilityRules: true },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_UPDATED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
      metadata: { changes: input },
    });

    return updated;
  }

  // ===========================================================================
  // DELETE (draft only)
  // ===========================================================================
  static async delete(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.DRAFT) {
      throw new ExperimentStateError('Only draft experiments can be deleted');
    }

    await prisma.experiment.delete({ where: { id: experimentId } });

    await AuditService.record({
      actorId,
      action: 'EXPERIMENT_DELETED',
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
    });
  }

  // ===========================================================================
  // LIFECYCLE: Publish
  // ===========================================================================
  static async publish(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.DRAFT && experiment.status !== EXPERIMENT_STATUS.PAUSED) {
      throw new ExperimentStateError('Only draft or paused experiments can be published');
    }

    // Get the latest version or create one
    let latestVersion = await prisma.experimentVersion.findFirst({
      where: { experimentId },
      orderBy: { versionNumber: 'desc' },
      include: { trials: true },
    });

    if (!latestVersion) {
      // Create initial version from experiment config
      const configSnapshot = {
        title: experiment.title,
        description: experiment.description,
        instructions: experiment.instructions,
        rewardPoints: experiment.rewardPoints,
        attemptPolicy: experiment.attemptPolicy,
        maxAttempts: experiment.maxAttempts,
      };

      latestVersion = await prisma.experimentVersion.create({
        data: {
          experimentId,
          versionNumber: 1,
          configSnapshot: configSnapshot as any,
          configHash: computeConfigHash(configSnapshot),
          publishedAt: new Date(),
          createdBy: actorId,
        },
        include: { trials: true },
      });
    } else if (!latestVersion.publishedAt) {
      // Mark existing version as published
      latestVersion = await prisma.experimentVersion.update({
        where: { id: latestVersion.id },
        data: { publishedAt: new Date() },
        include: { trials: true },
      });
    }

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: EXPERIMENT_STATUS.PUBLISHED },
      include: { eligibilityRules: true, versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    // Invalidate caches
    await cacheDeletePattern('experiments:public:*');
    await cacheDelete(`experiment:${experimentId}`);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_PUBLISHED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
      metadata: { versionId: latestVersion.id, versionNumber: latestVersion.versionNumber },
    });

    return updated;
  }

  // ===========================================================================
  // LIFECYCLE: Pause
  // ===========================================================================
  static async pause(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.PUBLISHED) {
      throw new ExperimentStateError('Only published experiments can be paused');
    }

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: EXPERIMENT_STATUS.PAUSED },
    });

    await cacheDeletePattern('experiments:public:*');
    await cacheDelete(`experiment:${experimentId}`);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_PAUSED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
    });

    return updated;
  }

  // ===========================================================================
  // LIFECYCLE: Close
  // ===========================================================================
  static async close(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.PUBLISHED && experiment.status !== EXPERIMENT_STATUS.PAUSED) {
      throw new ExperimentStateError('Only published or paused experiments can be closed');
    }

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: EXPERIMENT_STATUS.CLOSED },
    });

    await cacheDeletePattern('experiments:public:*');
    await cacheDelete(`experiment:${experimentId}`);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_CLOSED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
    });

    return updated;
  }

  // ===========================================================================
  // LIFECYCLE: Archive
  // ===========================================================================
  static async archive(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getById(experimentId, researcherProfileId);

    if (experiment.status !== EXPERIMENT_STATUS.CLOSED) {
      throw new ExperimentStateError('Only closed experiments can be archived');
    }

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: EXPERIMENT_STATUS.ARCHIVED },
    });

    await cacheDelete(`experiment:${experimentId}`);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_ARCHIVED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
    });

    return updated;
  }

  // ===========================================================================
  // PUBLIC LISTING (for participants)
  // ===========================================================================
  static async listPublic(query: { page?: number; limit?: number }) {
    const cacheKey = `experiments:public:${query.page || 1}:${query.limit || 20}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const pagination = parsePagination(query);

    const [experiments, total] = await Promise.all([
      prisma.experiment.findMany({
        where: {
          status: EXPERIMENT_STATUS.PUBLISHED,
          visibility: 'PUBLIC',
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          title: true,
          description: true,
          rewardPoints: true,
          attemptPolicy: true,
          createdAt: true,
          _count: { select: { sessions: true } },
        },
      }),
      prisma.experiment.count({
        where: { status: EXPERIMENT_STATUS.PUBLISHED, visibility: 'PUBLIC' },
      }),
    ]);

    const result = paginatedResult(experiments, total, pagination);
    await cacheSet(cacheKey, JSON.stringify(result), 60); // Cache for 60s
    return result;
  }

  // ===========================================================================
  // ELIGIBILITY CHECK
  // ===========================================================================
  static async checkEligibility(experimentId: string, participantProfileId: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { eligibilityRules: true },
    });

    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.status !== EXPERIMENT_STATUS.PUBLISHED) {
      return { eligible: false, reason: 'Experiment is not currently accepting participants' };
    }

    const participant = await prisma.participantProfile.findUnique({
      where: { id: participantProfileId },
    });

    if (!participant) {
      return { eligible: false, reason: 'Participant profile not found' };
    }

    // Check each eligibility rule
    for (const rule of experiment.eligibilityRules) {
      if (rule.ruleType === 'AGE_RANGE') {
        if (rule.minAge && participant.age < rule.minAge) {
          return { eligible: false, reason: 'Does not meet age requirement' };
        }
        if (rule.maxAge && participant.age > rule.maxAge) {
          return { eligible: false, reason: 'Does not meet age requirement' };
        }
      }

      if (rule.ruleType === 'RATING_RANGE') {
        if (rule.minRating && participant.qualityRating < rule.minRating) {
          return { eligible: false, reason: 'Does not meet rating requirement' };
        }
        if (rule.maxRating && participant.qualityRating > rule.maxRating) {
          return { eligible: false, reason: 'Does not meet rating requirement' };
        }
      }

      if (rule.ruleType === 'AVAILABILITY_WINDOW') {
        const now = new Date();
        if (rule.availabilityStart && now < rule.availabilityStart) {
          return { eligible: false, reason: 'Experiment is not yet available' };
        }
        if (rule.availabilityEnd && now > rule.availabilityEnd) {
          return { eligible: false, reason: 'Experiment availability window has passed' };
        }
      }
    }

    // Check attempt limits
    if (experiment.attemptPolicy === 'ALLOW_ONE_ATTEMPT') {
      const existingSession = await prisma.experimentSession.findFirst({
        where: {
          experimentId,
          participantId: participantProfileId,
          status: { in: ['COMPLETED', 'IN_PROGRESS', 'STARTED'] },
        },
      });
      if (existingSession) {
        return { eligible: false, reason: 'You have already participated in this experiment' };
      }
    } else if (experiment.attemptPolicy === 'ALLOW_MULTIPLE_ATTEMPTS') {
      const attemptCount = await prisma.experimentSession.count({
        where: {
          experimentId,
          participantId: participantProfileId,
          status: { in: ['COMPLETED'] },
        },
      });
      if (attemptCount >= experiment.maxAttempts) {
        return { eligible: false, reason: 'Maximum number of attempts reached' };
      }
    }

    return { eligible: true };
  }
}
