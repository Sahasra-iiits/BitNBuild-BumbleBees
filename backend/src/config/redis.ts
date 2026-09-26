// ==============================================================================
// SynapseLab — Redis Configuration
// ==============================================================================

import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../common/utils/logger';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      logger.error({ error: err.message }, 'Redis connection error');
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedis();
    await client.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn({ error }, 'Redis connection failed — continuing without cache');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis disconnected');
  }
}

// Cache helpers
export async function cacheGet(key: string): Promise<string | null> {
  try {
    const client = getRedis();
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedis();
    await client.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(key);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Cache failures are non-fatal
  }
}
