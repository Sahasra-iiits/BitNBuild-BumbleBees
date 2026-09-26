// ==============================================================================
// SynapseLab — Concurrency & Idempotency Tests
// ==============================================================================

import request from 'supertest';
import { app } from '../src/app';

const API_PREFIX = '/api/v1';

async function createResearcher() {
  const email = `res-conc-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({ email, password: 'ValidPass123', role: 'RESEARCHER' });
  return { token: res.body.accessToken, user: res.body.user };
}

async function createParticipant() {
  const email = `part-conc-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email, password: 'ValidPass123', role: 'PARTICIPANT',
      participantProfile: { age: 25 },
    });
  return { token: res.body.accessToken, user: res.body.user, profileId: res.body.user.participantProfile.id };
}

describe('Concurrency and Idempotency', () => {
  let researcherToken: string;
  let experimentId: string;
  let participantToken: string;

  beforeAll(async () => {
    const researcher = await createResearcher();
    researcherToken = researcher.token;

    const participant = await createParticipant();
    participantToken = participant.token;

    // Create and publish a 1-attempt experiment
    const expRes = await request(app)
      .post(`${API_PREFIX}/experiments`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({
        title: 'Concurrency Test',
        visibility: 'PUBLIC',
        attemptPolicy: 'ALLOW_ONE_ATTEMPT',
      });
    experimentId = expRes.body.id;

    await request(app)
      .post(`${API_PREFIX}/experiments/${experimentId}/publish`)
      .set('Authorization', `Bearer ${researcherToken}`);
  });

  describe('Session Start Idempotency', () => {
    it('should return same session for same idempotency key', async () => {
      const idempotencyKey = `session-start-${Date.now()}`;

      const res1 = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/sessions`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ idempotencyKey });

      expect(res1.status).toBe(201);
      const sessionId = res1.body.session.id;

      // Second request with same key
      const res2 = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/sessions`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ idempotencyKey });

      // Should return the exact same session, not a 409 limit error
      expect(res2.status).toBe(201);
      expect(res2.body.id || res2.body.session?.id).toBe(sessionId);
    });

    it('should reject multiple distinct attempts for 1-attempt experiment', async () => {
      const p2 = await createParticipant();

      // First attempt
      await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/sessions`)
        .set('Authorization', `Bearer ${p2.token}`)
        .send({ idempotencyKey: `start-p2-1` });

      // Second attempt (different key)
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/sessions`)
        .set('Authorization', `Bearer ${p2.token}`)
        .send({ idempotencyKey: `start-p2-2` });

      expect(res.status).toBe(409); // Conflict: already participated
    });
  });

  describe('Event Ingestion Idempotency', () => {
    it('should ignore duplicate events silently', async () => {
      const p3 = await createParticipant();
      
      const startRes = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/sessions`)
        .set('Authorization', `Bearer ${p3.token}`);
      
      const sessionId = startRes.body.session.id;
      const trialId = '00000000-0000-0000-0000-000000000001';

      const events = [
        {
          eventId: 'evt-1',
          trialId,
          trialSequence: 0,
          reactionTimeMs: 400,
        },
        {
          eventId: 'evt-2',
          trialId,
          trialSequence: 1,
          reactionTimeMs: 450,
        }
      ];

      // First ingestion
      const res1 = await request(app)
        .post(`${API_PREFIX}/sessions/${sessionId}/events/batch`)
        .set('Authorization', `Bearer ${p3.token}`)
        .send({ events });

      expect(res1.status).toBe(200);
      expect(res1.body.ingested).toBe(2);
      expect(res1.body.duplicates).toBe(0);

      // Second ingestion (exact same events)
      const res2 = await request(app)
        .post(`${API_PREFIX}/sessions/${sessionId}/events/batch`)
        .set('Authorization', `Bearer ${p3.token}`)
        .send({ events });

      expect(res2.status).toBe(200);
      expect(res2.body.ingested).toBe(0);
      expect(res2.body.duplicates).toBe(2);

      // Third ingestion (mix of old and new)
      const mixEvents = [
        ...events,
        {
          eventId: 'evt-3',
          trialId,
          trialSequence: 2,
          reactionTimeMs: 500,
        }
      ];

      const res3 = await request(app)
        .post(`${API_PREFIX}/sessions/${sessionId}/events/batch`)
        .set('Authorization', `Bearer ${p3.token}`)
        .send({ events: mixEvents });

      expect(res3.status).toBe(200);
      expect(res3.body.ingested).toBe(1);
      expect(res3.body.duplicates).toBe(2);
    });
  });
});
