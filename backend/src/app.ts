// ==============================================================================
// SynapseLab — Express Application
// ==============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { logger } from './common/utils/logger';
import { requestIdMiddleware } from './common/middleware/request-id';
import { generalLimiter } from './common/middleware/rate-limit';
import { errorHandler } from './common/middleware/error-handler';
import { apiRouter } from './routes';

const app = express();

// =============================================================================
// Security Headers
// =============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// =============================================================================
// Request Processing
// =============================================================================
app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    autoLogging: {
      ignore: (req) => {
        // Don't log health check requests
        return req.url === '/health' || req.url === '/ready';
      },
    },
  })
);

// =============================================================================
// CORS
// =============================================================================
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Correlation-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'X-Correlation-Id'],
    maxAge: 86400,
  })
);

// =============================================================================
// Body Parsing
// =============================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// =============================================================================
// Rate Limiting (general)
// =============================================================================
app.use(generalLimiter);

// =============================================================================
// Trust proxy (for load balancer / reverse proxy)
// =============================================================================
app.set('trust proxy', 1);

// =============================================================================
// Health Checks
// =============================================================================
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: env.APP_NAME,
    version: '1.0.0',
  });
});

app.get('/ready', async (_req, res) => {
  try {
    // Basic readiness check — extend with DB/Redis checks
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================================================
// API Routes
// =============================================================================
app.use(env.API_PREFIX, apiRouter);

// =============================================================================
// 404 Handler
// =============================================================================
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// =============================================================================
// Global Error Handler
// =============================================================================
app.use(errorHandler);

export { app };
