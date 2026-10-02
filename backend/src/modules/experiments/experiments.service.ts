// ==============================================================================
// SynapseLab — Experiment Service
// ==============================================================================

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { cacheDelete, cacheDeletePattern, cacheGet, cacheSet } from '../../config/redis';
import { AUDIT_ACTIONS, EXPERIMENT_STATUS } from '../../config/constants';
import {
  DraftConflictError,
  ExperimentStateError,
  ForbiddenError,
  NotFoundError,
  PublishValidationError,
  ValidationError,
} from '../../common/errors/app-error';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import { VersionService } from '../experiment-versions/versions.service';
import { resolveQualityRules } from '../quality/quality-rules';
import {
  countBySeverity,
  createEmptyDefinition,
  definitionFromSnapshot,
  DefinitionParseError,
  hasBlockingErrors,
  parseDefinition,
  validateDefinition,
  type ExperimentDefinition,
} from '../../shared/experiment';
import type { CreateExperimentInput, EligibilityRuleInput, UpdateExperimentInput } from './experiments.schema';

type DraftSource = 'draft' | 'published_version' | 'empty';

function eligibilityRuleData(rule: EligibilityRuleInput) {
  return {
    ruleType: rule.ruleType,
    minAge: rule.minAge ?? null,
    maxAge: rule.maxAge ?? null,
    minRating: rule.minRating ?? null,
    maxRating: rule.maxRating ?? null,
    availabilityStart: rule.availabilityStart ? new Date(rule.availabilityStart) : null,
    availabilityEnd: rule.availabilityEnd ? new Date(rule.availabilityEnd) : null,
  };
}

async function invalidateExperimentCaches(experimentId: string) {
  await cacheDeletePattern('experiments:public:*');
  await cacheDelete(`experiment:${experimentId}`);
  await cacheDelete(`version:latest:${experimentId}`);
}

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
        // Guests may only join public experiments.
        allowGuests: input.visibility === 'PUBLIC' && input.allowGuests,
        rewardPoints: input.rewardPoints,
        attemptPolicy: input.attemptPolicy,
        maxAttempts: input.maxAttempts,
        draftDefinition: createEmptyDefinition() as unknown as Prisma.InputJsonValue,
        eligibilityRules: input.eligibilityRules
          ? { create: input.eligibilityRules.map(eligibilityRuleData) }
          : undefined,
      },
      include: { eligibilityRules: true },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_CREATED,
      resourceType: 'EXPERIMENT',
      resourceId: experiment.id,
      metadata: { title: experiment.title },
    });

    return this.toResearcherView(experiment);
  }

  // ===========================================================================
  // READ
  // ===========================================================================
  static async listByResearcher(researcherProfileId: string, query: { page?: number; limit?: number; status?: string }) {
    const pagination = parsePagination(query);
    const where: Prisma.ExperimentWhereInput = { researcherId: researcherProfileId };
    if (query.status) where.status = query.status as Prisma.ExperimentWhereInput['status'];

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

    return paginatedResult(experiments.map((e) => this.toResearcherView(e)), total, pagination);
  }

  /** Loads an experiment the researcher owns (admins may read any). */
  static async getOwned(experimentId: string, researcherProfileId: string | undefined, isAdmin = false) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: {
        eligibilityRules: true,
        versions: { orderBy: { versionNumber: 'desc' }, select: { id: true, versionNumber: true, publishedAt: true, configHash: true, createdAt: true } },
        _count: { select: { sessions: true } },
      },
    });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (!isAdmin && experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }
    return experiment;
  }

  static async getForResearcher(experimentId: string, researcherProfileId: string | undefined, isAdmin: boolean) {
    const experiment = await this.getOwned(experimentId, researcherProfileId, isAdmin);
    const draft = this.readDraft(experiment, null);
    const hasUnpublishedChanges = await this.hasUnpublishedChanges(experiment.id, draft.definition);
    return { ...this.toResearcherView(experiment), draftRevision: experiment.draftRevision, draftUpdatedAt: experiment.draftUpdatedAt, hasUnpublishedChanges };
  }

  /**
   * What a participant may see: no eligibility internals, no version snapshots
   * (which contain correct answers), only experiments that are accepting or paused.
   */
  static async getForParticipant(experimentId: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      select: {
        id: true,
        title: true,
        description: true,
        instructions: true,
        status: true,
        visibility: true,
        allowGuests: true,
        rewardPoints: true,
        attemptPolicy: true,
        maxAttempts: true,
        researcher: { select: { institution: true } },
        versions: { where: { publishedAt: { not: null } }, orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true, versionNumber: true } },
      },
    });
    if (!experiment || (experiment.status !== EXPERIMENT_STATUS.PUBLISHED && experiment.status !== EXPERIMENT_STATUS.PAUSED)) {
      throw new NotFoundError('Experiment not found');
    }
    const { versions, ...rest } = experiment;
    return { ...rest, currentVersion: versions[0] ?? null };
  }

  private static toResearcherView<T extends { draftDefinition?: unknown; qualityRules?: unknown }>(experiment: T) {
    const { draftDefinition: _draft, qualityRules, ...rest } = experiment;
    return { ...rest, qualityRules: resolveQualityRules(qualityRules) };
  }

  // ===========================================================================
  // SETTINGS UPDATE
  // ===========================================================================
  static async update(experimentId: string, researcherProfileId: string, input: UpdateExperimentInput, actorId: string) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    if (experiment.status === EXPERIMENT_STATUS.ARCHIVED) {
      throw new ExperimentStateError('Archived experiments cannot be edited.');
    }

    const attemptPolicy = input.attemptPolicy ?? experiment.attemptPolicy;
    const maxAttempts = input.maxAttempts ?? experiment.maxAttempts;
    if (attemptPolicy === 'ALLOW_ONE_ATTEMPT' && input.maxAttempts !== undefined && input.maxAttempts !== 1) {
      throw new ValidationError('maxAttempts must be 1 when only one attempt is allowed');
    }

    const visibility = input.visibility ?? experiment.visibility;
    const allowGuests = input.allowGuests ?? experiment.allowGuests;
    if (input.allowGuests === true && visibility !== 'PUBLIC') {
      throw new ValidationError('Guests can only be allowed on public experiments');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.eligibilityRules) {
        await tx.eligibilityRule.deleteMany({ where: { experimentId } });
        if (input.eligibilityRules.length > 0) {
          await tx.eligibilityRule.createMany({
            data: input.eligibilityRules.map((r) => ({ ...eligibilityRuleData(r), experimentId })),
          });
        }
      }
      return tx.experiment.update({
        where: { id: experimentId },
        data: {
          title: input.title,
          description: input.description,
          instructions: input.instructions,
          visibility: input.visibility,
          // Making an experiment private also turns guest access off.
          allowGuests: visibility === 'PUBLIC' && allowGuests,
          rewardPoints: input.rewardPoints,
          attemptPolicy,
          maxAttempts: attemptPolicy === 'ALLOW_ONE_ATTEMPT' ? 1 : maxAttempts,
          qualityRules: input.qualityRules ? (input.qualityRules as Prisma.InputJsonValue) : undefined,
        },
        include: { eligibilityRules: true },
      });
    });

    await invalidateExperimentCaches(experimentId);
    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_UPDATED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
      metadata: { fields: Object.keys(input) },
    });

    return this.toResearcherView(updated);
  }

  // ===========================================================================
  // DELETE (unpublished drafts without data only)
  // ===========================================================================
  static async delete(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    if (experiment.status !== EXPERIMENT_STATUS.DRAFT) {
      throw new ExperimentStateError('Only draft experiments can be deleted');
    }
    if (experiment._count.sessions > 0 || experiment.versions.length > 0) {
      throw new ExperimentStateError('Experiments that have been published or have participant data cannot be deleted; archive them instead.');
    }

    await prisma.experiment.delete({ where: { id: experimentId } });
    await AuditService.record({ actorId, action: 'EXPERIMENT_DELETED', resourceType: 'EXPERIMENT', resourceId: experimentId });
  }

  // ===========================================================================
  // DRAFT
  // ===========================================================================
  private static readDraft(
    experiment: { draftDefinition: unknown; draftRevision: number },
    latestSnapshot: unknown | null
  ): { definition: ExperimentDefinition; source: DraftSource } {
    if (experiment.draftDefinition !== null && experiment.draftDefinition !== undefined) {
      try {
        return { definition: parseDefinition(experiment.draftDefinition), source: 'draft' };
      } catch (error) {
        if (error instanceof DefinitionParseError) {
          throw new ValidationError(`Stored draft is corrupted (${error.message}).`);
        }
        throw error;
      }
    }
    if (latestSnapshot) return { definition: definitionFromSnapshot(latestSnapshot), source: 'published_version' };
    return { definition: createEmptyDefinition(), source: 'empty' };
  }

  private static async latestSnapshot(experimentId: string) {
    const latest = await prisma.experimentVersion.findFirst({
      where: { experimentId },
      orderBy: { versionNumber: 'desc' },
      select: { configSnapshot: true },
    });
    return latest?.configSnapshot ?? null;
  }

  static async getDraft(experimentId: string, researcherProfileId: string) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    const snapshot = experiment.draftDefinition === null ? await this.latestSnapshot(experimentId) : null;
    const { definition, source } = this.readDraft(experiment, snapshot);
    return {
      definition,
      revision: experiment.draftRevision,
      updatedAt: experiment.draftUpdatedAt,
      source,
    };
  }

  static async saveDraft(experimentId: string, researcherProfileId: string, input: { definition: unknown; baseRevision: number }) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    if (experiment.status === EXPERIMENT_STATUS.ARCHIVED) {
      throw new ExperimentStateError('Archived experiments cannot be edited.');
    }

    let definition: ExperimentDefinition;
    try {
      definition = parseDefinition(input.definition);
    } catch (error) {
      if (error instanceof DefinitionParseError) throw new ValidationError(`Invalid experiment definition: ${error.message}`);
      throw error;
    }

    const now = new Date();
    // Compare-and-swap on the revision so a stale tab cannot overwrite newer work.
    const result = await prisma.experiment.updateMany({
      where: { id: experimentId, draftRevision: input.baseRevision },
      data: {
        draftDefinition: definition as unknown as Prisma.InputJsonValue,
        draftRevision: { increment: 1 },
        draftUpdatedAt: now,
      },
    });
    if (result.count === 0) {
      const current = await prisma.experiment.findUnique({ where: { id: experimentId }, select: { draftRevision: true } });
      throw new DraftConflictError({ currentRevision: current?.draftRevision ?? 0 });
    }
    return { revision: input.baseRevision + 1, updatedAt: now };
  }

  static async knownAssetIds(experimentId: string): Promise<Set<string>> {
    const assets = await prisma.experimentAsset.findMany({ where: { experimentId }, select: { id: true } });
    return new Set(assets.map((a) => a.id));
  }

  static async validateDraft(experimentId: string, researcherProfileId: string) {
    const { definition } = await this.getDraft(experimentId, researcherProfileId);
    const issues = validateDefinition(definition, { knownAssetIds: await this.knownAssetIds(experimentId) });
    return { issues, counts: countBySeverity(issues), canPublish: !hasBlockingErrors(issues) };
  }

  private static async hasUnpublishedChanges(experimentId: string, draft: ExperimentDefinition): Promise<boolean> {
    const snapshot = await this.latestSnapshot(experimentId);
    if (!snapshot) return true;
    return VersionService.definitionHash(definitionFromSnapshot(snapshot)) !== VersionService.definitionHash(draft);
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Validates the draft and, if it differs from the latest version, snapshots it
   * as a new immutable version. Running sessions keep the version they started on.
   */
  static async publish(experimentId: string, researcherProfileId: string, actorId: string) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    const allowed: string[] = [EXPERIMENT_STATUS.DRAFT, EXPERIMENT_STATUS.PAUSED, EXPERIMENT_STATUS.PUBLISHED];
    if (!allowed.includes(experiment.status)) {
      throw new ExperimentStateError(`A ${experiment.status.toLowerCase()} experiment cannot be published.`);
    }

    const snapshot = experiment.draftDefinition === null ? await this.latestSnapshot(experimentId) : null;
    const { definition } = this.readDraft(experiment, snapshot);
    const issues = validateDefinition(definition, { knownAssetIds: await this.knownAssetIds(experimentId) });
    if (hasBlockingErrors(issues)) {
      throw new PublishValidationError({ issues });
    }

    const { version, created } = await VersionService.createFromDefinition(experiment, definition, actorId);

    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: EXPERIMENT_STATUS.PUBLISHED },
      include: { eligibilityRules: true },
    });

    await invalidateExperimentCaches(experimentId);
    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.EXPERIMENT_PUBLISHED,
      resourceType: 'EXPERIMENT',
      resourceId: experimentId,
      metadata: { versionId: version.id, versionNumber: version.versionNumber, versionCreated: created },
    });

    return {
      experiment: this.toResearcherView(updated),
      version: { id: version.id, versionNumber: version.versionNumber, created },
      warnings: issues.filter((i) => i.severity === 'warning'),
    };
  }

  private static async transition(
    experimentId: string,
    researcherProfileId: string,
    actorId: string,
    from: string[],
    to: string,
    action: string
  ) {
    const experiment = await this.getOwned(experimentId, researcherProfileId);
    if (!from.includes(experiment.status)) {
      throw new ExperimentStateError(`Cannot change a ${experiment.status.toLowerCase()} experiment to ${to.toLowerCase()}.`);
    }
    const updated = await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: to as Prisma.ExperimentUpdateInput['status'] },
      include: { eligibilityRules: true },
    });
    await invalidateExperimentCaches(experimentId);
    await AuditService.record({ actorId, action, resourceType: 'EXPERIMENT', resourceId: experimentId });
    return this.toResearcherView(updated);
  }

  static pause(experimentId: string, researcherProfileId: string, actorId: string) {
    return this.transition(experimentId, researcherProfileId, actorId, [EXPERIMENT_STATUS.PUBLISHED], EXPERIMENT_STATUS.PAUSED, AUDIT_ACTIONS.EXPERIMENT_PAUSED);
  }

  /** Re-opens a paused experiment on its current version without publishing draft edits. */
  static resume(experimentId: string, researcherProfileId: string, actorId: string) {
    return this.transition(experimentId, researcherProfileId, actorId, [EXPERIMENT_STATUS.PAUSED], EXPERIMENT_STATUS.PUBLISHED, 'EXPERIMENT_RESUMED');
  }

  static close(experimentId: string, researcherProfileId: string, actorId: string) {
    return this.transition(
      experimentId,
      researcherProfileId,
      actorId,
      [EXPERIMENT_STATUS.PUBLISHED, EXPERIMENT_STATUS.PAUSED],
      EXPERIMENT_STATUS.CLOSED,
      AUDIT_ACTIONS.EXPERIMENT_CLOSED
    );
  }

  static archive(experimentId: string, researcherProfileId: string, actorId: string) {
    return this.transition(experimentId, researcherProfileId, actorId, [EXPERIMENT_STATUS.CLOSED], EXPERIMENT_STATUS.ARCHIVED, AUDIT_ACTIONS.EXPERIMENT_ARCHIVED);
  }

  // ===========================================================================
  // PUBLIC LISTING (for participants)
  // ===========================================================================
  static async listPublic(query: { page?: number; limit?: number }, guestsOnly = false) {
    const cacheKey = `experiments:public:${guestsOnly ? 'guest' : 'all'}:${query.page || 1}:${query.limit || 20}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const pagination = parsePagination(query);
    const where: Prisma.ExperimentWhereInput = { status: EXPERIMENT_STATUS.PUBLISHED, visibility: 'PUBLIC', ...(guestsOnly ? { allowGuests: true } : {}) };

    const [experiments, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          title: true,
          description: true,
          rewardPoints: true,
          allowGuests: true,
          attemptPolicy: true,
          maxAttempts: true,
          createdAt: true,
          // Researcher emails are personal data and are not exposed to participants.
          researcher: { select: { institution: true } },
        },
      }),
      prisma.experiment.count({ where }),
    ]);

    const result = paginatedResult(experiments, total, pagination);
    await cacheSet(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  // ===========================================================================
  // ELIGIBILITY
  // ===========================================================================
  static async checkEligibility(experimentId: string, participantProfileId: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { eligibilityRules: true },
    });

    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.status !== EXPERIMENT_STATUS.PUBLISHED) {
      return { eligible: false, code: 'NOT_ACCEPTING', reason: 'This experiment is not currently accepting participants.' };
    }

    const participant = await prisma.participantProfile.findUnique({ where: { id: participantProfileId }, include: { user: { select: { isGuest: true } } } });
    if (!participant) return { eligible: false, code: 'NO_PROFILE', reason: 'Participant profile not found.' };
    if (participant.user.isGuest && !(experiment.visibility === 'PUBLIC' && experiment.allowGuests)) {
      return { eligible: false, code: 'ACCOUNT_REQUIRED', reason: 'This experiment needs a participant account. Create a free account to take part.' };
    }

    const now = new Date();
    for (const rule of experiment.eligibilityRules) {
      if (rule.ruleType === 'AGE_RANGE') {
        if (participant.age === null) {
          return { eligible: false, code: 'ACCOUNT_REQUIRED', reason: 'This experiment has an age requirement. Create a free account with your age to take part.' };
        }
        if (rule.minAge !== null && participant.age < rule.minAge) {
          return { eligible: false, code: 'AGE_NOT_MET', reason: `Participants must be at least ${rule.minAge} years old.` };
        }
        if (rule.maxAge !== null && participant.age > rule.maxAge) {
          return { eligible: false, code: 'AGE_NOT_MET', reason: `Participants must be at most ${rule.maxAge} years old.` };
        }
      }
      if (rule.ruleType === 'RATING_RANGE') {
        if (rule.minRating !== null && participant.qualityRating < rule.minRating) {
          return { eligible: false, code: 'RATING_TOO_LOW', reason: `A participant rating of at least ${rule.minRating} is required.` };
        }
        if (rule.maxRating !== null && participant.qualityRating > rule.maxRating) {
          return { eligible: false, code: 'RATING_TOO_HIGH', reason: `This study is limited to participants rated ${rule.maxRating} or below.` };
        }
      }
      if (rule.ruleType === 'AVAILABILITY_WINDOW') {
        if (rule.availabilityStart && now < rule.availabilityStart) {
          return { eligible: false, code: 'NOT_YET_AVAILABLE', reason: 'This experiment is not available yet.' };
        }
        if (rule.availabilityEnd && now > rule.availabilityEnd) {
          return { eligible: false, code: 'WINDOW_PASSED', reason: 'The availability window for this experiment has passed.' };
        }
      }
    }

    const attempts = await this.attemptSummary(experiment, participantProfileId, prisma, participant.user.isGuest);
    if (!attempts.canStartNew && !attempts.activeSessionId) {
      return { eligible: false, code: 'ATTEMPT_LIMIT_REACHED', reason: attempts.reason, attempts };
    }
    return { eligible: true, attempts };
  }

  /**
   * Attempt accounting shared by the eligibility check and session start.
   * ALLOW_ONE_ATTEMPT: any started/in-progress/completed session uses the attempt
   * (an unfinished one can be resumed). ALLOW_MULTIPLE_ATTEMPTS: completed sessions count.
   */
  static async attemptSummary(
    experiment: { id: string; attemptPolicy: string; maxAttempts: number },
    participantProfileId: string,
    client: Prisma.TransactionClient = prisma,
    /** Guests get one attempt per experiment (per device, since a device keeps its guest). */
    guest = false
  ) {
    const sessions = await client.experimentSession.findMany({
      where: { experimentId: experiment.id, participantId: participantProfileId },
      select: { id: true, status: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
    });
    const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
    const active = sessions.find((s) => s.status === 'STARTED' || s.status === 'IN_PROGRESS');
    const excluded = sessions.filter((s) => s.status === 'EXCLUDED').length;

    if (experiment.attemptPolicy === 'ALLOW_ONE_ATTEMPT' || guest) {
      const used = completed + excluded > 0;
      return {
        policy: guest ? 'ALLOW_ONE_ATTEMPT' : experiment.attemptPolicy,
        completed,
        maxAttempts: 1,
        activeSessionId: active?.id ?? null,
        canStartNew: !used && !active,
        reason: used
          ? guest
            ? 'This study has already been completed from this device.'
            : 'You have already participated in this experiment.'
          : active
            ? 'You have an unfinished session for this experiment.'
            : '',
      };
    }
    const limitReached = completed >= experiment.maxAttempts;
    return {
      policy: experiment.attemptPolicy,
      completed,
      maxAttempts: experiment.maxAttempts,
      activeSessionId: active?.id ?? null,
      canStartNew: !limitReached,
      reason: limitReached ? `You have reached the maximum of ${experiment.maxAttempts} completed attempts.` : '',
    };
  }
}
