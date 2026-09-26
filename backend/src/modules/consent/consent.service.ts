// ==============================================================================
// SynapseLab — Consent Service
// ==============================================================================

import { prisma } from '../../config/database';
import { AUDIT_ACTIONS } from '../../config/constants';
import { NotFoundError, ForbiddenError, ConflictError } from '../../common/errors/app-error';
import { hashConsentText } from '../../common/utils/crypto';
import { AuditService } from '../audit/audit.service';

export interface CreateConsentInput {
  experimentId: string;
  versionId: string;
  consentVersion: string;
  consentText: string;
}

export class ConsentService {
  /**
   * Record participant consent.
   */
  static async recordConsent(
    participantProfileId: string,
    input: CreateConsentInput,
    actorId: string
  ) {
    // Verify experiment exists
    const experiment = await prisma.experiment.findUnique({
      where: { id: input.experimentId },
    });
    if (!experiment) throw new NotFoundError('Experiment not found');

    // Check for existing consent
    const existing = await prisma.participantConsent.findFirst({
      where: {
        participantId: participantProfileId,
        experimentId: input.experimentId,
        versionId: input.versionId,
        withdrawnAt: null,
      },
    });

    if (existing) return existing;

    const consent = await prisma.participantConsent.create({
      data: {
        participantId: participantProfileId,
        experimentId: input.experimentId,
        versionId: input.versionId,
        consentVersion: input.consentVersion,
        consentTextHash: hashConsentText(input.consentText),
      },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.CONSENT_GIVEN,
      resourceType: 'CONSENT',
      resourceId: consent.id,
      metadata: { experimentId: input.experimentId, consentVersion: input.consentVersion },
    });

    return consent;
  }

  /**
   * Withdraw consent.
   */
  static async withdrawConsent(
    consentId: string,
    participantProfileId: string,
    actorId: string
  ) {
    const consent = await prisma.participantConsent.findUnique({
      where: { id: consentId },
    });

    if (!consent) throw new NotFoundError('Consent not found');
    if (consent.participantId !== participantProfileId) {
      throw new ForbiddenError('Not your consent record');
    }
    if (consent.withdrawnAt) {
      throw new ConflictError('Consent already withdrawn');
    }

    const updated = await prisma.participantConsent.update({
      where: { id: consentId },
      data: { withdrawnAt: new Date() },
    });

    await AuditService.record({
      actorId,
      action: AUDIT_ACTIONS.CONSENT_WITHDRAWN,
      resourceType: 'CONSENT',
      resourceId: consentId,
      metadata: { experimentId: consent.experimentId },
    });

    return updated;
  }

  /**
   * Get participant's consent records.
   */
  static async getParticipantConsents(participantProfileId: string) {
    return prisma.participantConsent.findMany({
      where: { participantId: participantProfileId },
      orderBy: { agreedAt: 'desc' },
    });
  }
}
