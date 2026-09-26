// ==============================================================================
// SynapseLab — Export Worker (BullMQ)
// ==============================================================================

import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis';
import { ExportService } from '../modules/exports/exports.service';
import { logger } from '../common/utils/logger';

export const EXPORT_QUEUE_NAME = 'export-jobs';

let worker: Worker | null = null;

export function startExportWorker() {
  if (worker) return;

  logger.info('Starting Export worker...');

  worker = new Worker(
    EXPORT_QUEUE_NAME,
    async (job: Job) => {
      const { exportId, researcherId, actorId } = job.data;
      logger.info({ exportId }, `Processing export job ${job.id}`);
      
      // We expose a public static method on ExportService to handle this now
      await ExportService.executeJob(exportId, researcherId, actorId);
    },
    {
      connection: getRedis(),
      concurrency: 2, // Limit concurrency for heavy export operations
    }
  );

  worker.on('completed', (job) => {
    logger.info({ exportId: job.data.exportId }, `Export job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error({ exportId: job?.data.exportId, err }, `Export job ${job?.id} failed`);
  });
}

export async function stopExportWorker() {
  if (worker) {
    logger.info('Stopping Export worker...');
    await worker.close();
    worker = null;
  }
}
