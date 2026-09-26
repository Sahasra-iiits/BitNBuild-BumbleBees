// ==============================================================================
// SynapseLab — Redis Configuration
// ==============================================================================

import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../common/utils/logger';

// BullMQ requires `maxRetriesPerRequest: null`, which makes commands wait forever
// while Redis is down. The cache therefore uses its own fail-fast connection so an
// outage degrades to "no cache" instead of hanging every request.
let queueRedis: Redis | null = null;
let cacheRedis: Redis | null = null;

function attachLogging(client: Redis, name: string) {
  client.on('connect', () => logger.info(`Redis (${name}) connected`));
  client.on('error', (err) => logger.error({ error: err.message }, `Redis (${name}) connection error`));
}

/** Connection for BullMQ queues and workers. */
export function getRedis(): Redis {
  if (!queueRedis) {
    queueRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });
    attachLogging(queueRedis, 'queue');
  }
  return queueRedis;
}

function getCacheRedis(): Redis {
  if (!cacheRedis) {
    cacheRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 1000,
      retryStrategy: (times) => Math.min(times * 500, 10000),
      lazyConnect: true,
    });
    attachLogging(cacheRedis, 'cache');
  }
  return cacheRedis;
}

export async function connectRedis(): Promise<void> {
  try {
    await getRedis().connect();
    await getCacheRedis().connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn({ error }, 'Redis connection failed — continuing without cache');
  }
}

export async function disconnectRedis(): Promise<void> {
  for (const client of [queueRedis, cacheRedis]) {
    if (client) await client.quit().catch((err: Error) => logger.warn({ error: err.message }, 'Redis quit failed'));
  }
  queueRedis = null;
  cacheRedis = null;
  logger.info('Redis disconnected');
}

function cacheUsable(): Redis | null {
  const client = getCacheRedis();
  return client.status === 'ready' ? client : null;
}

// Cache helpers: failures are logged and treated as a cache miss.
export async function cacheGet(key: string): Promise<string | null> {
  const client = cacheUsable();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (error) {
    logger.warn({ key, error: (error as Error).message }, 'cache get failed');
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = cacheUsable();
  if (!client) return;
  try {
    await client.set(key, value, 'EX', ttlSeconds);
  } catch (error) {
    logger.warn({ key, error: (error as Error).message }, 'cache set failed');
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = cacheUsable();
  if (!client) return;
  try {
    await client.del(key);
  } catch (error) {
    logger.warn({ key, error: (error as Error).message }, 'cache delete failed');
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = cacheUsable();
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  } catch (error) {
    logger.warn({ pattern, error: (error as Error).message }, 'cache pattern delete failed');
  }
}
