// ==============================================================================
// SynapseLab — Assets Router
// ==============================================================================

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AssetService } from './assets.service';
import { ASSET_LIMITS } from '../../config/constants';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';
import { getParam } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const assetsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(ASSET_LIMITS.IMAGE_MAX_BYTES, ASSET_LIMITS.AUDIO_MAX_BYTES), files: 1, fields: 5 },
});

const experimentIdParam = z.object({ id: z.string().uuid() });
const assetIdParam = z.object({ assetId: z.string().uuid() });

/** POST /experiments/:id/assets — upload one file (multipart field "file"). */
assetsRouter.post(
  '/experiments/:id/assets',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  upload.single('file'),
  route(async (req, res) => {
    const asset = await AssetService.upload(getParam(req, 'id'), req.user!.researcherProfileId!, req.file, req.user!.userId);
    res.status(201).json(asset);
  })
);

assetsRouter.get(
  '/experiments/:id/assets',
  authenticate,
  requireResearcher,
  validate({ params: experimentIdParam }),
  route(async (req, res) => {
    res.json(await AssetService.list(getParam(req, 'id'), req.user!.researcherProfileId!));
  })
);

/** GET /assets/:assetId/content — authenticated download; clients turn it into an object URL. */
assetsRouter.get(
  '/assets/:assetId/content',
  authenticate,
  validate({ params: assetIdParam }),
  route(async (req, res) => {
    const { asset, data } = await AssetService.getContent(getParam(req, 'assetId'), {
      role: req.user!.role,
      researcherProfileId: req.user!.researcherProfileId,
      participantProfileId: req.user!.participantProfileId,
    });
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', String(data.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=3600, immutable');
    res.setHeader('ETag', `"${asset.sha256}"`);
    res.end(data);
  })
);
