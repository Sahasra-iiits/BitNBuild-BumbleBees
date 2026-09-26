// ==============================================================================
// CogniScale Frontend — Sessions API (Experiment Runner)
// ==============================================================================
// CRITICAL: This module powers the high-precision experiment runner.
// Event batching, idempotency, and retry logic live here.
// NEVER make per-trial network requests — batch everything.

import { api } from './client';
import {
  StartSessionRequest,
  StartSessionResponse,
  BatchEvent,
  BatchEventRequest,
  ExperimentSession,
} from '../types/api';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Sessions API
// =============================================================================

export const sessionsApi = {
  // Start a new session — returns full version config for local execution
  start: async (experimentId: string, data: StartSessionRequest = {}): Promise<StartSessionResponse> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 500));
      // Import mock version for local runner
      const { versionsApi } = await import('./experiments');
      const version = await versionsApi.get(experimentId, 'mock');
      return {
        id: `session-mock-${Date.now()}`,
        experimentId,
        versionId: version.id,
        participantId: 'part-mock-1',
        pseudonymousRef: `pseudo-${uuidv4().slice(0, 8)}`,
        status: 'STARTED',
        startedAt: new Date().toISOString(),
        version,
      };
    }
    return api.post<StartSessionResponse>(
      `/experiments/${experimentId}/sessions`,
      {
        ...data,
        // Generate idempotency key if not provided to prevent double-session
        idempotencyKey: data.idempotencyKey || `${experimentId}-${Date.now()}`,
      }
    );
  },

  // Ingest a batch of trial response events (idempotent via eventId)
  ingestBatch: async (sessionId: string, events: BatchEvent[]): Promise<{ accepted: number; duplicates: number }> => {
    if (api.useMock) {
      console.log(`[Mock API] Ingesting ${events.length} events for session ${sessionId}`);
      await new Promise(r => setTimeout(r, 200));
      return { accepted: events.length, duplicates: 0 };
    }
    return api.post<{ accepted: number; duplicates: number }>(
      `/sessions/${sessionId}/events/batch`,
      { events } satisfies BatchEventRequest
    );
  },

  // Complete a session
  complete: async (sessionId: string): Promise<ExperimentSession> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 300));
      return {
        id: sessionId,
        experimentId: 'exp-mock-1',
        versionId: 'ver-mock-1',
        participantId: 'part-mock-1',
        pseudonymousRef: 'pseudo-abc',
        status: 'COMPLETED',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }
    return api.post<ExperimentSession>(`/sessions/${sessionId}/complete`);
  },

  // Get session details
  get: async (sessionId: string): Promise<ExperimentSession> => {
    if (api.useMock) {
      return {
        id: sessionId,
        experimentId: 'exp-mock-1',
        versionId: 'ver-mock-1',
        participantId: 'part-mock-1',
        pseudonymousRef: 'pseudo-abc',
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      };
    }
    return api.get<ExperimentSession>(`/sessions/${sessionId}`);
  },
};

// =============================================================================
// Event Buffer — for high-precision runner
// =============================================================================
// Collects events locally and flushes to backend in configurable batches.
// Survives short network interruptions by retrying with exponential backoff.

const FLUSH_INTERVAL_MS = 5000;    // Flush every 5 seconds
const MAX_BATCH_SIZE = 50;          // Max events per batch
const MAX_RETRY_ATTEMPTS = 3;

export class EventBuffer {
  private buffer: BatchEvent[] = [];
  private sessionId: string;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private isFlushing = false;
  private retryQueue: BatchEvent[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.scheduleFlush();
  }

  // Add a new event to the buffer
  push(event: Omit<BatchEvent, 'eventId'>): void {
    const fullEvent: BatchEvent = {
      ...event,
      eventId: uuidv4(), // Unique idempotency key
    };
    this.buffer.push(fullEvent);

    // Flush immediately if buffer is getting large
    if (this.buffer.length >= MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  // Flush current buffer to backend
  async flush(): Promise<void> {
    if (this.isFlushing) return;
    
    const toSend = [...this.retryQueue, ...this.buffer.splice(0, MAX_BATCH_SIZE)];
    if (toSend.length === 0) return;

    this.isFlushing = true;
    this.retryQueue = [];

    let attempt = 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        await sessionsApi.ingestBatch(this.sessionId, toSend);
        this.isFlushing = false;
        this.scheduleFlush();
        return;
      } catch (error) {
        attempt++;
        if (attempt < MAX_RETRY_ATTEMPTS) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        } else {
          // Max retries exceeded — put events back in retry queue
          console.error('[EventBuffer] Failed to flush after max retries. Events queued for retry.');
          this.retryQueue = toSend;
        }
      }
    }
    
    this.isFlushing = false;
    this.scheduleFlush();
  }

  // Final flush before session completion
  async flushAll(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    
    const toSend = [...this.retryQueue, ...this.buffer.splice(0)];
    if (toSend.length === 0) return;

    let attempt = 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        await sessionsApi.ingestBatch(this.sessionId, toSend);
        this.retryQueue = [];
        return;
      } catch (error) {
        attempt++;
        if (attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        }
      }
    }
    console.error('[EventBuffer] Final flush failed. Some events may be lost.');
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  destroy(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }
}
