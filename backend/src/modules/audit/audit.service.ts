// ==============================================================================
// SynapseLab — Audit Service
// ==============================================================================

import { prisma } from '../../config/database';
import { logger } from '../../common/utils/logger';

export interface AuditInput {
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddressRedacted?: string;
  userAgent?: string;
  correlationId?: string;
}

export class AuditService {
  /**
   * Record an audit event. This is fire-and-forget to avoid
   * slowing down the main request path.
   */
  static async record(input: AuditInput): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          actorId: input.actorId,
          actorRole: input.actorRole,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          metadata: input.metadata as any,
          ipAddress: input.ipAddressRedacted,
          userAgent: input.userAgent,
          correlationId: input.correlationId,
        },
      });
    } catch (error) {
      // Audit logging failure should never crash the application
      logger.error({ error, input: { action: input.action, resourceType: input.resourceType } }, 'Failed to record audit event');
    }
  }

  /**
   * Query audit events (admin only).
   */
  static async query(filters: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return { events, total };
  }
}
