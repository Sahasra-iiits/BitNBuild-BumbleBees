// ==============================================================================
// SynapseLab — Structured Logger (Pino)
// ==============================================================================
// Sensitive data is automatically redacted.

import pino from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'secret',
  'sessionSecret',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'debug',
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
