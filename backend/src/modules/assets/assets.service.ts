// ==============================================================================
// SynapseLab — Experiment Assets (uploaded images and audio)
// ==============================================================================
// Files are stored on local disk under UPLOAD_DIR/<experimentId>/<assetId> and are
// immutable: replacing a stimulus uploads a new asset, so published versions that
// reference the old file keep working.

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ASSET_LIMITS, EXPERIMENT_STATUS } from '../../config/constants';
import {
  ExperimentStateError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from '../../common/errors/app-error';
import { AuditService } from '../audit/audit.service';
import { detectMediaType } from './file-type';

const uploadRoot = () => path.resolve(env.UPLOAD_DIR);

function storagePath(storageKey: string): string {
  const full = path.resolve(uploadRoot(), storageKey);
  // storageKey is generated server-side, but never let a path escape the upload root.
  if (!full.startsWith(uploadRoot() + path.sep)) throw new Error('Invalid storage key');
  return full;
}

function sanitizeName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, '_').trim();
  return (base || 'file').slice(0, 200);
}

export interface Viewer {
  role: string;
  researcherProfileId?: string;
  participantProfileId?: string;
}

export class AssetService {
  static async upload(
    experimentId: string,
    researcherProfileId: string,
    file: { buffer: Buffer; originalname: string; size: number } | undefined,
    actorId: string
  ) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');
    if (experiment.status === EXPERIMENT_STATUS.ARCHIVED) throw new ExperimentStateError('Archived experiments cannot be edited.');
    if (!file || file.size === 0) throw new ValidationError('No file was uploaded (form field "file").');

    const detected = detectMediaType(file.buffer);
    if (!detected) {
      throw new ValidationError('Unsupported or corrupted file. Images: PNG, JPEG, GIF, WebP. Audio: MP3, WAV, OGG, FLAC, AAC, M4A, WebM.');
    }
    const limit = detected.kind === 'IMAGE' ? ASSET_LIMITS.IMAGE_MAX_BYTES : ASSET_LIMITS.AUDIO_MAX_BYTES;
    if (file.size > limit) {
      throw new PayloadTooLargeError(`${detected.kind === 'IMAGE' ? 'Images' : 'Audio files'} must be at most ${Math.round(limit / (1024 * 1024))} MB.`);
    }

    const assetId = crypto.randomUUID();
    const storageKey = `${experimentId}/${assetId}`;
    const fullPath = storagePath(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer, { flag: 'wx' });

    try {
      const asset = await prisma.experimentAsset.create({
        data: {
          id: assetId,
          experimentId,
          kind: detected.kind,
          mimeType: detected.mimeType,
          sizeBytes: file.size,
          originalName: sanitizeName(file.originalname),
          storageKey,
          sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
          uploadedBy: actorId,
        },
      });
      await AuditService.record({
        actorId,
        action: 'ASSET_UPLOADED',
        resourceType: 'EXPERIMENT_ASSET',
        resourceId: asset.id,
        metadata: { experimentId, kind: asset.kind, sizeBytes: asset.sizeBytes },
      });
      return this.toView(asset);
    } catch (error) {
      await fs.rm(fullPath, { force: true });
      throw error;
    }
  }

  static async list(experimentId: string, researcherProfileId: string) {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherProfileId) throw new ForbiddenError('You do not own this experiment');
    const assets = await prisma.experimentAsset.findMany({ where: { experimentId }, orderBy: { createdAt: 'desc' } });
    return assets.map((a) => this.toView(a));
  }

  /**
   * Owners may always read their assets. Participants may read assets of experiments
   * that are live or paused, or of experiments they have a session in.
   */
  static async getContent(assetId: string, viewer: Viewer) {
    const asset = await prisma.experimentAsset.findUnique({
      where: { id: assetId },
      include: { experiment: { select: { researcherId: true, status: true } } },
    });
    if (!asset) throw new NotFoundError('Asset not found');

    let allowed = false;
    if (viewer.role === 'ADMIN') allowed = true;
    else if (viewer.role === 'RESEARCHER') allowed = asset.experiment.researcherId === viewer.researcherProfileId;
    else if (viewer.role === 'PARTICIPANT' && viewer.participantProfileId) {
      const live = asset.experiment.status === EXPERIMENT_STATUS.PUBLISHED || asset.experiment.status === EXPERIMENT_STATUS.PAUSED;
      allowed =
        live ||
        (await prisma.experimentSession.count({
          where: { experimentId: asset.experimentId, participantId: viewer.participantProfileId },
        })) > 0;
    }
    if (!allowed) throw new NotFoundError('Asset not found');

    let data: Buffer;
    try {
      data = await fs.readFile(storagePath(asset.storageKey));
    } catch {
      throw new NotFoundError('Asset file is missing from storage');
    }
    return { asset, data };
  }

  private static toView(asset: {
    id: string;
    experimentId: string;
    kind: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
    sha256: string;
    createdAt: Date;
  }) {
    return {
      id: asset.id,
      experimentId: asset.experimentId,
      kind: asset.kind,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      originalName: asset.originalName,
      sha256: asset.sha256,
      createdAt: asset.createdAt,
    };
  }
}
