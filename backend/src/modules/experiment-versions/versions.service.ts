// ==============================================================================
// SynapseLab — Experiment Versions Service
// ==============================================================================

import { prisma } from '../../config/database';
import { cacheDelete, cacheGet, cacheSet } from '../../config/redis';
import { AUDIT_ACTIONS } from '../../config/constants';
import { ForbiddenError, NotFoundError, ExperimentStateError } from '../../common/errors/app-error';
import { computeConfigHash } from '../../common/utils/crypto';
import { AuditService } from '../audit/audit.service';

export interface CreateVersionInput {
  trials?: Array<any>;
  logicRules?: Array<{
    sourceTrialId?: string;
    targetTrialId?: string;
    conditionType: string;
    condition: Record<string, unknown>;
    priority?: number;
  }>;
  randomization?: Array<{
    strategy: string;
    seed?: string;
    configuration: Record<string, unknown>;
  }>;
}

export class VersionService {
  /**
   * List versions for an experiment.
   */
  static async list(experimentId: string, researcherProfileId: string) {
    // Verify ownership
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    return prisma.experimentVersion.findMany({
      where: { experimentId },
      orderBy: { versionNumber: 'desc' },
      include: {
        _count: { select: { trials: true, sessions: true } },
      },
    });
  }

  /**
   * Get a specific version with full configuration.
   */
  static async getById(experimentId: string, versionId: string, researcherProfileId?: string) {
    // Try cache first
    const cacheKey = `version:${versionId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const version = await prisma.experimentVersion.findUnique({
      where: { id: versionId },
      include: {
        trials: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            elements: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        logicRules: true,
        randomization: true,
        experiment: {
          select: { id: true, researcherId: true, title: true, rewardPoints: true },
        },
      },
    });

    if (!version || version.experimentId !== experimentId) {
      throw new NotFoundError('Version not found');
    }

    if (researcherProfileId && version.experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    // Cache published versions (immutable)
    if (version.publishedAt) {
      await cacheSet(cacheKey, JSON.stringify(version), 3600); // 1 hour
    }

    return version;
  }

  /**
   * Get the latest published version for participant use.
   */
  static async getLatestPublished(experimentId: string) {
    const cacheKey = `version:latest:${experimentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const version = await prisma.experimentVersion.findFirst({
      where: {
        experimentId,
        publishedAt: { not: null },
      },
      orderBy: { versionNumber: 'desc' },
      include: {
        trials: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            elements: { orderBy: { sequenceOrder: 'asc' } },
          },
        },
        logicRules: true,
        randomization: true,
      },
    });

    if (!version) {
      throw new NotFoundError('No published version found');
    }

    await cacheSet(cacheKey, JSON.stringify(version), 300); // 5 min
    return version;
  }

  /**
   * Create a new version (with trials, logic, randomization).
   */
  static async create(
    experimentId: string,
    researcherProfileId: string,
    input: CreateVersionInput,
    actorId: string
  ) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    // Get next version number
    const lastVersion = await prisma.experimentVersion.findFirst({
      where: { experimentId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

    // Build config snapshot
    const configSnapshot = {
      title: experiment.title,
      description: experiment.description,
      instructions: experiment.instructions,
      rewardPoints: experiment.rewardPoints,
      trials: input.trials,
      logicRules: input.logicRules,
      randomization: input.randomization,
    };

    // Create version with all nested data in a transaction
    const version = await prisma.$transaction(async (tx) => {
      const ver = await tx.experimentVersion.create({
        data: {
          experimentId,
          versionNumber: nextVersionNumber,
          configSnapshot: configSnapshot as any,
          configHash: computeConfigHash(configSnapshot),
          createdBy: actorId,
          publishedAt: new Date(),
        },
      });

      // Create trials
      if (input.trials?.length) {
        let trialSequence = 0;
        for (const trial of input.trials) {
          const trialType = trial.elements?.[0]?.type || 'CUSTOM';
          const createdTrial = await tx.experimentTrial.create({
            data: {
              id: trial.id,
              versionId: ver.id,
              sequenceOrder: trial.sequenceOrder ?? trialSequence++,
              trialType: trial.trialType || trialType,
              name: trial.name || 'Unnamed Trial',
              configuration: trial as any,
              stimulusConfig: trial.stimulusConfig as any || {},
              durationMs: trial.durationMs || null,
              timeoutMs: trial.timeoutMs || null,
            },
          });

          // Create elements
          if (trial.elements?.length) {
            let elementSequence = 0;
            await tx.trialElement.createMany({
              data: trial.elements.map((el: any) => ({
                trialId: createdTrial.id,
                elementType: el.type || el.elementType || 'UNKNOWN',
                configuration: el as any,
                sequenceOrder: el.sequenceOrder ?? elementSequence++,
              })),
            });
          }
        }
      }

      // Create logic rules
      if (input.logicRules?.length) {
        await tx.logicRule.createMany({
          data: input.logicRules.map((rule) => ({
            versionId: ver.id,
            sourceTrialId: rule.sourceTrialId,
            targetTrialId: rule.targetTrialId,
            conditionType: rule.conditionType,
            condition: rule.condition as any,
            priority: rule.priority || 0,
          })),
        });
      }

      // Create randomization configs
      if (input.randomization?.length) {
        await tx.randomizationConfig.createMany({
          data: input.randomization.map((r) => ({
            versionId: ver.id,
            strategy: r.strategy,
            seed: r.seed,
            configuration: r.configuration as any,
          })),
        });
      }

      return ver;
    });

    // Invalidate caches
    await cacheDelete(`version:latest:${experimentId}`);

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_VERSION_CREATED,
      resourceType: 'EXPERIMENT_VERSION',
      resourceId: version.id,
      metadata: { experimentId, versionNumber: nextVersionNumber },
    });

    // Return full version
    return this.getById(experimentId, version.id, researcherProfileId);
  }
}
