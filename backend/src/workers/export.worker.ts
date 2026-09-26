// ==============================================================================
// SynapseLab — Export Worker (BullMQ)
// ==============================================================================

import { Queue, Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis';
import { ExportService, setExportEnqueuer } from '../modules/exports/exports.service';
import { logger } from '../common/utils/logger';

export const EXPORT_QUEUE_NAME = 'export-jobs';

let worker: Worker | null = null;
let queue: Queue | null = null;

interface ExportJobData {
  exportId: string;
  actorId: string;
}

/**
 * Starts the worker when Redis is reachable. Without Redis, exports are generated
 * inline by the API request instead of silently sitting in a queue nobody reads.
 */
export function startExportWorker() {
  if (worker) return;
  const connection = getRedis();
  if (connection.status !== 'ready') {
    logger.warn('Redis unavailable — export jobs will run inline');
    return;
  }

  queue = new Queue(EXPORT_QUEUE_NAME, { connection });
  worker = new Worker<ExportJobData>(
    EXPORT_QUEUE_NAME,
    async (job: Job<ExportJobData>) => {
      logger.info({ exportId: job.data.exportId }, `Processing export job ${job.id}`);
      await ExportService.executeJob(job.data.exportId, job.data.actorId);
    },
    { connection, concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ exportId: job?.data.exportId, err }, `Export job ${job?.id} failed`);
  });

  const activeQueue = queue;
  setExportEnqueuer(async (data) => {
    await activeQueue.add('generate-export', data, { removeOnComplete: 100, removeOnFail: 100 });
  });
  logger.info('Export worker started');
}

export async function stopExportWorker() {
  setExportEnqueuer(null);
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
