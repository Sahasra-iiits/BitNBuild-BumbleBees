// ==============================================================================
// SynapseLab — Database Configuration (Prisma)
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../common/utils/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

// Log slow queries in development
prisma.$on('query' as never, (e: any) => {
  if (e.duration > 100) {
    logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected');
  }
});

prisma.$on('error' as never, (e: any) => {
  logger.error({ error: e }, 'Prisma error');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to database');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
