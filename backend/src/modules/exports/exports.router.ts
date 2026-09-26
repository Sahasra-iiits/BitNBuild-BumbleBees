// ==============================================================================
// SynapseLab — Exports Router
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { ExportService } from './exports.service';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requireResearcher } from '../../common/middleware/authorize';
import { exportLimiter } from '../../common/middleware/rate-limit';
import { getParam, validatedQuery } from '../../common/utils/request-helpers';
import { route } from '../../common/utils/route';

export const exportsRouter = Router();

const createExportSchema = z.object({
  experimentId: z.string().uuid(),
  format: z.enum(['CSV', 'XLSX', 'JSON']),
  filters: z
    .object({
      includeExcluded: z.boolean().optional(),
      versionId: z.string().uuid().optional(),
    })
    .optional(),
  idempotencyKey: z.string().max(100).optional(),
});

const exportIdParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({ experimentId: z.string().uuid() });

exportsRouter.post(
  '/',
  authenticate,
  requireResearcher,
  exportLimiter,
  validate({ body: createExportSchema }),
  route(async (req, res) => {
    res.status(202).json(await ExportService.createExport(req.user!.researcherProfileId!, req.body, req.user!.userId));
  })
);

exportsRouter.get(
  '/',
  authenticate,
  requireResearcher,
  validate({ query: listQuery }),
  route(async (req, res) => {
    const q = validatedQuery<z.infer<typeof listQuery>>(req);
    res.json(await ExportService.listExports(req.user!.researcherProfileId!, q.experimentId));
  })
);

exportsRouter.get(
  '/:id',
  authenticate,
  requireResearcher,
  validate({ params: exportIdParam }),
  route(async (req, res) => {
    res.json(await ExportService.getExport(getParam(req, 'id'), req.user!.researcherProfileId!));
  })
);

exportsRouter.get(
  '/:id/download',
  authenticate,
  requireResearcher,
  validate({ params: exportIdParam }),
  route(async (req, res) => {
    const file = await ExportService.getDownload(getParam(req, 'id'), req.user!.researcherProfileId!);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(file.fileName);
    await new Promise<void>((resolve, reject) => {
      res.sendFile(file.path, (err) => (err ? reject(err) : resolve()));
    });
  })
);
