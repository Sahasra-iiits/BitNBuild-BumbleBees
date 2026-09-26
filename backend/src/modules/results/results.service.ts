// ==============================================================================
// SynapseLab — Results Service
// ==============================================================================
// Computes aggregate results from raw trial response data.

import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error';
import { parsePagination, paginatedResult } from '../../common/utils/pagination';

export class ResultsService {
  /**
   * Compute aggregate results for an experiment, grouped by condition.
   */
  static async getAggregateResults(experimentId: string, researcherProfileId: string, versionId?: string) {
    // Verify ownership
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    // Get all non-excluded sessions
    const sessionFilter: any = {
      experimentId,
      status: { in: ['COMPLETED', 'IN_PROGRESS'] },
    };
    if (versionId) sessionFilter.versionId = versionId;

    const sessions = await prisma.experimentSession.findMany({
      where: sessionFilter,
      select: { id: true, status: true, participantId: true },
    });

    const sessionIds = sessions.map((s) => s.id);

    // Get all non-excluded responses
    const responses = await prisma.trialResponse.findMany({
      where: {
        sessionId: { in: sessionIds },
        excluded: false,
      },
      select: {
        condition: true,
        reactionTimeMs: true,
        correct: true,
        timeout: true,
        excluded: true,
      },
    });

    // Group by condition
    const conditionMap = new Map<string, Array<{
      reactionTimeMs: number | null;
      correct: boolean | null;
      timeout: boolean;
    }>>();

    for (const r of responses) {
      const condition = r.condition || 'DEFAULT';
      if (!conditionMap.has(condition)) {
        conditionMap.set(condition, []);
      }
      conditionMap.get(condition)!.push({
        reactionTimeMs: r.reactionTimeMs,
        correct: r.correct,
        timeout: r.timeout,
      });
    }

    // Compute aggregates per condition
    const results = Array.from(conditionMap.entries()).map(([condition, data]) => {
      const rts = data
        .filter((d) => d.reactionTimeMs != null && !d.timeout)
        .map((d) => d.reactionTimeMs!);

      const correctCount = data.filter((d) => d.correct === true).length;
      const incorrectCount = data.filter((d) => d.correct === false).length;
      const scoredCount = correctCount + incorrectCount;

      const meanRt = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
      const sortedRts = [...rts].sort((a, b) => a - b);
      const medianRt = sortedRts.length > 0
        ? sortedRts.length % 2 === 0
          ? (sortedRts[sortedRts.length / 2 - 1] + sortedRts[sortedRts.length / 2]) / 2
          : sortedRts[Math.floor(sortedRts.length / 2)]
        : null;

      const stdRt = rts.length > 1 && meanRt !== null
        ? Math.sqrt(rts.reduce((sum, rt) => sum + Math.pow(rt - meanRt, 2), 0) / (rts.length - 1))
        : null;

      return {
        condition,
        n: data.length,
        meanRt: meanRt !== null ? Math.round(meanRt * 100) / 100 : null,
        medianRt: medianRt !== null ? Math.round(medianRt * 100) / 100 : null,
        stdRt: stdRt !== null ? Math.round(stdRt * 100) / 100 : null,
        accuracy: scoredCount > 0 ? Math.round((correctCount / scoredCount) * 10000) / 100 : null,
        errorRate: scoredCount > 0 ? Math.round((incorrectCount / scoredCount) * 10000) / 100 : null,
      };
    });

    // Summary stats
    const totalParticipants = new Set(sessions.map((s) => s.participantId)).size;
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length;
    const excludedSessions = await prisma.experimentSession.count({
      where: { experimentId, status: 'EXCLUDED' },
    });

    // Save computed results
    for (const r of results) {
      await prisma.experimentResult.upsert({
        where: {
          id: `${experimentId}:${versionId || 'all'}:${r.condition}`,
        },
        create: {
          experimentId,
          versionId,
          condition: r.condition,
          n: r.n,
          meanRt: r.meanRt,
          medianRt: r.medianRt,
          stdRt: r.stdRt,
          accuracy: r.accuracy,
          errorRate: r.errorRate,
        },
        update: {
          n: r.n,
          meanRt: r.meanRt,
          medianRt: r.medianRt,
          stdRt: r.stdRt,
          accuracy: r.accuracy,
          errorRate: r.errorRate,
          computedAt: new Date(),
        },
      }).catch(() => {
        // Upsert may fail on id format, just create
        return prisma.experimentResult.create({
          data: {
            experimentId,
            versionId,
            condition: r.condition,
            n: r.n,
            meanRt: r.meanRt,
            medianRt: r.medianRt,
            stdRt: r.stdRt,
            accuracy: r.accuracy,
            errorRate: r.errorRate,
          },
        });
      });
    }

    return {
      experimentId,
      versionId,
      summary: {
        totalParticipants,
        completedSessions,
        excludedSessions,
        totalResponses: responses.length,
      },
      conditions: results,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * List participants for an experiment.
   */
  static async listParticipants(
    experimentId: string,
    researcherProfileId: string,
    query: { page?: number; limit?: number; status?: string }
  ) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    const pagination = parsePagination(query);
    const where: any = { experimentId };
    if (query.status) where.status = query.status;

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
          _count: { select: { responses: true, qualitySignals: true } },
        },
      }),
      prisma.experimentSession.count({ where }),
    ]);

    return paginatedResult(sessions, total, pagination);
  }

  /**
   * Get raw data for an experiment (for analysis/export).
   */
  static async getRawData(
    experimentId: string,
    researcherProfileId: string,
    options: { includeExcluded?: boolean; versionId?: string; limit?: number; offset?: number }
  ) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) {
      throw new ForbiddenError('You do not own this experiment');
    }

    const sessionFilter: any = { experimentId };
    if (options.versionId) sessionFilter.versionId = options.versionId;
    if (!options.includeExcluded) sessionFilter.status = { not: 'EXCLUDED' };

    const responses = await prisma.trialResponse.findMany({
      where: {
        session: sessionFilter,
        ...(options.includeExcluded ? {} : { excluded: false }),
      },
      include: {
        session: {
          select: {
            pseudonymousRef: true,
            versionId: true,
            status: true,
          },
        },
        trial: {
          select: {
            name: true,
            trialType: true,
            sequenceOrder: true,
          },
        },
      },
      orderBy: [{ sessionId: 'asc' }, { trialSequence: 'asc' }],
      take: options.limit || 10000,
      skip: options.offset || 0,
    });

    return responses.map((r) => ({
      participantId: r.session.pseudonymousRef,
      experimentId,
      version: r.session.versionId,
      sessionId: r.sessionId,
      sessionStatus: r.session.status,
      trialId: r.trialId,
      trialName: r.trial.name,
      trialType: r.trial.trialType,
      trialSequence: r.trialSequence,
      condition: r.condition,
      stimulus: r.stimulusId,
      response: r.response,
      correct: r.correct,
      reactionTimeMs: r.reactionTimeMs,
      timeout: r.timeout,
      excluded: r.excluded,
      exclusionReason: r.exclusionReason,
    }));
  }
}
