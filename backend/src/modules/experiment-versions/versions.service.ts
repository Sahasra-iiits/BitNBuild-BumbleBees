// ==============================================================================
// SynapseLab — Experiment Versions Service
// ==============================================================================
// Versions are immutable snapshots created only by publishing. Each version gets
// its own trial rows (fresh primary keys) that carry the builder's stable trial id
// as `trialKey`, so re-publishing never collides and responses from different
// versions stay comparable.

import type { Experiment, EligibilityRule, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { cacheDelete, cacheGet, cacheSet } from '../../config/redis';
import { AUDIT_ACTIONS } from '../../config/constants';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { computeConfigHash } from '../../common/utils/crypto';
import { AuditService } from '../audit/audit.service';
import { resolveQualityRules } from '../quality/quality-rules';
import {
  DEFINITION_SCHEMA_VERSION,
  definitionFromSnapshot,
  getResponseElements,
  type ExperimentDefinition,
} from '../../shared/experiment';

type ExperimentWithRules = Experiment & { eligibilityRules: EligibilityRule[] };

export class VersionService {
  static definitionHash(definition: ExperimentDefinition): string {
    return computeConfigHash(definition);
  }

  static async list(experimentId: string, researcherProfileId: string) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');

    const versions = await prisma.experimentVersion.findMany({
      where: { experimentId },
      orderBy: { versionNumber: 'desc' },
      include: { _count: { select: { trials: true, sessions: true } } },
    });
    return versions.map(({ configSnapshot, ...v }) => ({
      ...v,
      trialCount: definitionFromSnapshot(configSnapshot).trials.length,
    }));
  }

  /** Researcher view of a version including its full definition (with correct answers). */
  static async getById(experimentId: string, versionId: string, researcherProfileId: string) {
    const version = await prisma.experimentVersion.findUnique({
      where: { id: versionId },
      include: { experiment: { select: { researcherId: true } } },
    });
    if (!version || version.experimentId !== experimentId) throw new NotFoundError('Version not found');
    if (version.experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');

    const { experiment: _owner, configSnapshot, ...rest } = version;
    return { ...rest, definition: definitionFromSnapshot(configSnapshot), snapshot: configSnapshot };
  }

  static async getLatestPublished(experimentId: string) {
    const cacheKey = `version:latest:${experimentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached) as { id: string; versionNumber: number; configSnapshot: unknown };

    const version = await prisma.experimentVersion.findFirst({
      where: { experimentId, publishedAt: { not: null } },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, configSnapshot: true },
    });
    if (!version) throw new NotFoundError('No published version found');

    await cacheSet(cacheKey, JSON.stringify(version), 300);
    return version;
  }

  /**
   * Creates a new version from a validated definition, or returns the latest version
   * when the definition is unchanged (re-publishing identical content is a no-op).
   */
  static async createFromDefinition(experiment: ExperimentWithRules, definition: ExperimentDefinition, actorId: string) {
    const definitionHash = this.definitionHash(definition);

    const version = await prisma.$transaction(async (tx) => {
      // Serialize concurrent publishes of the same experiment so version numbers stay unique.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`publish:${experiment.id}`}))`;

      const latest = await tx.experimentVersion.findFirst({
        where: { experimentId: experiment.id },
        orderBy: { versionNumber: 'desc' },
      });
      if (latest && this.definitionHash(definitionFromSnapshot(latest.configSnapshot)) === definitionHash) {
        const reused = latest.publishedAt
          ? latest
          : await tx.experimentVersion.update({ where: { id: latest.id }, data: { publishedAt: new Date() } });
        return { version: reused, created: false };
      }

      const snapshot = {
        schemaVersion: DEFINITION_SCHEMA_VERSION,
        definition,
        settings: {
          title: experiment.title,
          description: experiment.description,
          instructions: experiment.instructions,
          rewardPoints: experiment.rewardPoints,
          attemptPolicy: experiment.attemptPolicy,
          maxAttempts: experiment.maxAttempts,
          qualityRules: resolveQualityRules(experiment.qualityRules),
          eligibilityRules: experiment.eligibilityRules.map((r) => ({
            ruleType: r.ruleType,
            minAge: r.minAge,
            maxAge: r.maxAge,
            minRating: r.minRating,
            maxRating: r.maxRating,
            availabilityStart: r.availabilityStart,
            availabilityEnd: r.availabilityEnd,
          })),
        },
      };

      const created = await tx.experimentVersion.create({
        data: {
          experimentId: experiment.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          configSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          configHash: computeConfigHash(snapshot),
          createdBy: actorId,
          publishedAt: new Date(),
        },
      });

      for (const [index, trial] of definition.trials.entries()) {
        const responseTypes = getResponseElements(trial).map((e) => e.type);
        const createdTrial = await tx.experimentTrial.create({
          data: {
            versionId: created.id,
            trialKey: trial.id,
            sequenceOrder: index,
            trialType: responseTypes.length > 0 ? 'RESPONSE' : 'DISPLAY',
            name: trial.name,
            configuration: trial as unknown as Prisma.InputJsonValue,
            durationMs: trial.durationMs,
            timeoutMs: trial.advanceMode === 'response_or_timeout' ? trial.durationMs : null,
          },
        });
        if (trial.elements.length > 0) {
          await tx.trialElement.createMany({
            data: trial.elements.map((el, elementIndex) => ({
              trialId: createdTrial.id,
              elementType: el.type,
              configuration: el as unknown as Prisma.InputJsonValue,
              sequenceOrder: elementIndex,
            })),
          });
        }
      }
      return { version: created, created: true };
    });

    await cacheDelete(`version:latest:${experiment.id}`);
    if (version.created) {
      await AuditService.record({
        actorId,
        action: AUDIT_ACTIONS.EXPERIMENT_VERSION_CREATED,
        resourceType: 'EXPERIMENT_VERSION',
        resourceId: version.version.id,
        metadata: { experimentId: experiment.id, versionNumber: version.version.versionNumber },
      });
    }
    return version;
  }
}
