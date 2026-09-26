import { api, ApiRequestError } from './client';
import { isRecord, readJson, removeKey, writeJson } from '../storage';
import type { BatchEvent, CompletionOutcome, IngestResult, MySession, StartSessionResponse } from '../types/api';

export const sessionsApi = {
  start: (experimentId: string, body: { idempotencyKey: string; consentId?: string; clientMetadata?: Record<string, unknown> }) =>
    api.post<StartSessionResponse>(`/experiments/${experimentId}/sessions`, body),
  ingestBatch: (sessionId: string, events: BatchEvent[]) => api.post<IngestResult>(`/sessions/${sessionId}/events/batch`, { events }),
  complete: (sessionId: string) => api.post<CompletionOutcome>(`/sessions/${sessionId}/complete`),
  listMine: () => api.get<MySession[]>('/sessions/me'),
};

// =============================================================================
// Event outbox
// =============================================================================
// Trial events are persisted locally the moment a trial ends and sent in the
// background in batches, so the running experiment never waits on the network
// and a reload or brief outage does not lose responses. Event ids make resending
// safe: the server ignores duplicates.

const FLUSH_DELAY_MS = 3000;
const FLUSH_BATCH_THRESHOLD = 10;
const MAX_BATCH = 100;

export interface OutboxStatus {
  pending: number;
  sending: boolean;
  lastError: string | null;
  /** Set when the server rejected the data itself (not a network problem). */
  fatal: boolean;
}

function isEventArray(value: unknown): value is BatchEvent[] {
  return Array.isArray(value) && value.every((e) => isRecord(e) && typeof e.eventId === 'string' && typeof e.trialId === 'string');
}

export class EventOutbox {
  private readonly key: string;
  private pending: BatchEvent[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private status: OutboxStatus;
  private listener: ((s: OutboxStatus) => void) | null = null;
  private persisted = true;

  constructor(private readonly sessionId: string) {
    this.key = `bitnbuild:outbox:${sessionId}`;
    this.pending = readJson(this.key, isEventArray) ?? [];
    this.status = { pending: this.pending.length, sending: false, lastError: null, fatal: false };
  }

  onStatus(listener: ((s: OutboxStatus) => void) | null) {
    this.listener = listener;
    listener?.(this.status);
  }

  /** False when events could not be written to local storage (they are still kept in memory). */
  get isPersisted() {
    return this.persisted;
  }

  private update(patch: Partial<OutboxStatus>) {
    this.status = { ...this.status, ...patch, pending: this.pending.length };
    this.listener?.(this.status);
  }

  private persist() {
    if (this.pending.length === 0) {
      removeKey(this.key);
      this.persisted = true;
    } else {
      this.persisted = writeJson(this.key, this.pending);
    }
  }

  enqueue(event: BatchEvent) {
    this.pending.push(event);
    this.persist();
    this.update({});
    if (this.pending.length >= FLUSH_BATCH_THRESHOLD) void this.flush().catch(() => undefined);
    else this.schedule();
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => undefined);
    }, FLUSH_DELAY_MS);
  }

  /** Sends pending events once. Rejects on failure (events stay queued unless fatal). */
  flush(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.pending.length === 0) return Promise.resolve();
    const batch = this.pending.slice(0, MAX_BATCH);
    this.update({ sending: true });
    this.inflight = sessionsApi
      .ingestBatch(this.sessionId, batch)
      .then(() => {
        const sent = new Set(batch.map((e) => e.eventId));
        this.pending = this.pending.filter((e) => !sent.has(e.eventId));
        this.persist();
        this.update({ sending: false, lastError: null });
      })
      .catch((error: unknown) => {
        const fatal = error instanceof ApiRequestError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 401 && error.statusCode !== 429;
        this.update({ sending: false, lastError: error instanceof Error ? error.message : 'Upload failed', fatal });
        if (!fatal) this.schedule();
        throw error;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  /** Sends everything, retrying transient failures with backoff. */
  async flushAll(maxAttempts = 5): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    let attempt = 0;
    while (this.pending.length > 0 || this.inflight) {
      try {
        await this.flush();
        attempt = 0;
      } catch (error) {
        attempt += 1;
        if (this.status.fatal || attempt >= maxAttempts) throw error;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }

  get size() {
    return this.pending.length;
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listener = null;
  }
}
