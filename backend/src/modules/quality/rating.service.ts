// ==============================================================================
// Participant rating changes
// ==============================================================================
// The only code path that changes ParticipantProfile.qualityRating. Every change
// is bounded, serialized per participant, and recorded as an immutable event with
// the evidence that caused it.

import type { Prisma } from '@prisma/client';
import { RATING } from '../../config/constants';
import { NotFoundError } from '../../common/errors/app-error';

export interface RatingChangeInput {
  participantId: string;
  delta: number;
  reason: string;
  source: 'SYSTEM' | 'RESEARCHER' | 'ADMIN';
  experimentId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AppliedRatingChange {
  oldRating: number;
  newRating: number;
  delta: number;
  reason: string;
}

/** Must be called inside a transaction; locks the participant row until it commits. */
export async function applyRatingChange(
  tx: Prisma.TransactionClient,
  input: RatingChangeInput
): Promise<AppliedRatingChange | null> {
  if (!Number.isFinite(input.delta) || input.delta === 0) return null;

  const rows = await tx.$queryRaw<Array<{ qualityRating: number }>>`
    SELECT "qualityRating" FROM participant_profiles WHERE id = ${input.participantId} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError('Participant not found');

  const oldRating = rows[0].qualityRating;
  const newRating = Math.min(RATING.MAX, Math.max(RATING.MIN, oldRating + input.delta));
  const applied = newRating - oldRating;
  if (applied === 0) return null;

  await tx.participantRatingEvent.create({
    data: {
      participantId: input.participantId,
      oldRating,
      delta: applied,
      newRating,
      reason: input.reason,
      source: input.source,
      experimentId: input.experimentId ?? null,
      sessionId: input.sessionId ?? null,
      metadata: { requestedDelta: input.delta, ...(input.metadata ?? {}) } as Prisma.InputJsonValue,
    },
  });
  await tx.participantProfile.update({ where: { id: input.participantId }, data: { qualityRating: newRating } });
  return { oldRating, newRating, delta: applied, reason: input.reason };
}
