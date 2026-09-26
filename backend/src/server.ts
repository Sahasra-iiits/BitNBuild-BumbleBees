// ==============================================================================
// SynapseLab — Server Entry Point
// ==============================================================================

import { env } from './config/env';
import { logger } from './common/utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { startExportWorker, stopExportWorker } from './workers/export.worker';
import { app } from './app';

async function bootstrap(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, `Starting ${env.APP_NAME} server...`);

  // Connect to database
  await connectDatabase();

  // Connect to Redis (non-fatal if unavailable)
  await connectRedis();

  // Start Background Workers
  startExportWorker();

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        apiPrefix: env.API_PREFIX,
      },
      `${env.APP_NAME} server listening on port ${env.PORT}`
    );
    logger.info(`API: http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Health: http://localhost:${env.PORT}/health`);
    logger.info(`Docs: http://localhost:${env.PORT}${env.API_PREFIX}/docs`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(async () => {
      logger.info('HTTP server closed');
      await stopExportWorker();
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('All connections closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled rejection handler
  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
