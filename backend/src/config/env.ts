// ==============================================================================
// SynapseLab — Environment Configuration
// ==============================================================================

import dotenv from 'dotenv';
dotenv.config();

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function optionalIntEnv(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function optionalBoolEnv(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val === 'true' || val === '1';
}

export const env = {
  // Server
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: optionalIntEnv('PORT', 4000),
  API_PREFIX: optionalEnv('API_PREFIX', '/api/v1'),
  IS_PRODUCTION: optionalEnv('NODE_ENV', 'development') === 'production',
  IS_TEST: optionalEnv('NODE_ENV', 'development') === 'test',

  // Database
  DATABASE_URL: requiredEnv('DATABASE_URL'),

  // Redis
  REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: requiredEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requiredEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRY: optionalEnv('JWT_ACCESS_EXPIRY', '15m'),
  JWT_REFRESH_EXPIRY: optionalEnv('JWT_REFRESH_EXPIRY', '7d'),

  // CORS
  CORS_ORIGINS: optionalEnv('CORS_ORIGINS', 'http://localhost:3000').split(',').map(s => s.trim()),

  // Cookie
  COOKIE_DOMAIN: optionalEnv('COOKIE_DOMAIN', 'localhost'),
  COOKIE_SECURE: optionalBoolEnv('COOKIE_SECURE', false),
  COOKIE_SAMESITE: optionalEnv('COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
  COOKIE_HTTP_ONLY: optionalBoolEnv('COOKIE_HTTP_ONLY', true),

  // CSRF
  CSRF_SECRET: optionalEnv('CSRF_SECRET', 'dev-csrf-secret-change-in-prod'),

  // S3
  S3_ENDPOINT: optionalEnv('S3_ENDPOINT', 'http://localhost:9000'),
  S3_ACCESS_KEY: optionalEnv('S3_ACCESS_KEY', 'minioadmin'),
  S3_SECRET_KEY: optionalEnv('S3_SECRET_KEY', 'minioadmin'),
  S3_BUCKET_NAME: optionalEnv('S3_BUCKET_NAME', 'synapselab-assets'),
  S3_REGION: optionalEnv('S3_REGION', 'us-east-1'),
  S3_FORCE_PATH_STYLE: optionalBoolEnv('S3_FORCE_PATH_STYLE', true),

  // Logging
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'debug'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: optionalIntEnv('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_GENERAL: optionalIntEnv('RATE_LIMIT_MAX_GENERAL', 1000),
  RATE_LIMIT_MAX_AUTH: optionalIntEnv('RATE_LIMIT_MAX_AUTH', 20),
  RATE_LIMIT_MAX_EVENTS: optionalIntEnv('RATE_LIMIT_MAX_EVENTS', 500),

  // Export
  EXPORT_DIR: optionalEnv('EXPORT_DIR', './exports'),
  EXPORT_EXPIRY_HOURS: optionalIntEnv('EXPORT_EXPIRY_HOURS', 24),

  // Uploaded experiment assets (local disk storage)
  UPLOAD_DIR: optionalEnv('UPLOAD_DIR', './uploads'),

  // App
  APP_NAME: optionalEnv('APP_NAME', 'SynapseLab'),
  APP_URL: optionalEnv('APP_URL', 'http://localhost:4000'),
} as const;
