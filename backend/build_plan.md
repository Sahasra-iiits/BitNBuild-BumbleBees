# SynapseLab Backend Build Plan

## Phase 1: Foundation (COMPLETED)
- [x] Project Initialization (TypeScript, Express)
- [x] Dependency configuration (`package.json`)
- [x] Environment configuration (`.env.example`)
- [x] Database Schema design (Prisma PostgreSQL)
  - [x] Core: User, Profiles, Sessions
  - [x] Experiments: Versions, Trials, Logic, Randomization
  - [x] Data: Events, Results, Exports, Quality Flags
- [x] Infrastructure setup (Docker Compose, TSConfig, Jest)

## Phase 2: Core Infrastructure (COMPLETED)
- [x] Central configuration module (`env.ts`, `database.ts`, `redis.ts`, `constants.ts`)
- [x] Logging & Audit module (`logger.ts`, `audit.service.ts`)
- [x] Error handling & Validation middleware (`error-handler.ts`, `validate.ts`, Zod setup)
- [x] Security middleware (Helmet, CORS, Rate Limiting)
- [x] Authentication & Authorization middleware (JWT, Roles)
- [x] Express Application scaffolding (`app.ts`, `server.ts`)
- [x] OpenAPI / Swagger setup (`openapi.ts`)

## Phase 3: Identity & Access Management (COMPLETED)
- [x] User Registration & Login (Argon2id/Bcrypt fallback)
- [x] JWT lifecycle management (Access & Refresh tokens via HTTP-only cookies)
- [x] Role-Based Access Control (Admin, Researcher, Participant)
- [x] Session revocation tracking

## Phase 4: Experiment Engine (COMPLETED)
- [x] Experiment Lifecycle Management (Draft -> Published -> Paused -> Closed)
- [x] Immutable Versioning System (Trials, Logic, Randomization)
- [x] Participant Eligibility Checks (Age, Rating, Attempts)
- [x] Idempotent Session Management
- [x] Batch Event Ingestion (Idempotency, Fast-response detection)

## Phase 5: Data, Quality & Analytics (COMPLETED)
- [x] Quality Control (Flags, Participant Ratings, Exclusions)
- [x] Consent Tracking & Withdrawal
- [x] Analytics (On-the-fly Aggregate Results per condition)
- [x] Async Data Exports (CSV, XLSX, JSON generation)
- [x] Global Seed Script for realistic data (`prisma/seed.ts`)

## Implementation Complete
The backend API has been fully implemented and passes all TypeScript strict mode checks. 
Because the system heavily relies on PostgreSQL (for JSONB and relational integrity) and Redis (for caching and rate limiting), a local runtime environment with these services is required to start the server.
