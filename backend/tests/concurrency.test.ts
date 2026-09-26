// ==============================================================================
// SynapseLab — Sessions, ingestion, completion, concurrency and idempotency
// ==============================================================================

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import {
  API,
  complete,
  createParticipant,
  createResearcher,
  element,
  event,
  ingest,
  publishedExperiment,
  simpleDefinition,
  startSession,
  trial,
  unique,
} from './helpers';
import { createEmptyDefinition } from '../src/shared/experiment';

describe('Session start', () => {
  let researcherToken: string;
  beforeAll(async () => {
    researcherToken = (await createResearcher()).token;
  });

  it('returns the same session for the same idempotency key and never another participant’s', async () => {
    const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition);
    const p1 = await createParticipant();
    const p2 = await createParticipant();
    const key = `shared-key-${unique()}`;

    const first = await startSession(p1.token, experimentId, key);
    expect(first.status).toBe(201);
    expect(first.body.resumed).toBe(false);
    const resumed = await startSession(p1.token, experimentId, key);
    expect(resumed.status).toBe(200);
    expect(resumed.body.session.id).toBe(first.body.session.id);

    // Same key from a different participant must create their own session.
    const other = await startSession(p2.token, experimentId, key);
    expect(other.status).toBe(201);
    expect(other.body.session.id).not.toBe(first.body.session.id);
  });

  it('delivers the definition without correct answers', async () => {
    const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition);
    const p = await createParticipant();
    const res = await startSession(p.token, experimentId);
    const kb = res.body.version.definition.trials[1].elements[0];
    expect(kb.scoring).toEqual({ enabled: false, correctKey: null });
    expect(kb.config.allowedKeys).toEqual(['a', 'l']);
  });

  it('enforces a single attempt, including under concurrent starts', async () => {
    const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition, { attemptPolicy: 'ALLOW_ONE_ATTEMPT', maxAttempts: 1 });
    const p = await createParticipant();
    const results = await Promise.all([1, 2, 3, 4].map(() => startSession(p.token, experimentId)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await prisma.experimentSession.count({ where: { experimentId } })).toBe(1);
  });

  it('allows repeated attempts up to maxAttempts completions', async () => {
    const { definition, ids } = simpleDefinition();
    const { experimentId } = await publishedExperiment(researcherToken, definition, { attemptPolicy: 'ALLOW_MULTIPLE_ATTEMPTS', maxAttempts: 2 });
    const p = await createParticipant();

    for (let attempt = 0; attempt < 2; attempt++) {
      const s = await startSession(p.token, experimentId);
      expect(s.status).toBe(201);
      const sessionId = s.body.session.id;
      await ingest(p.token, sessionId, [
        event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue', reactionTimeMs: null }),
        event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'a' }] }),
        event({ trialId: ids.ynTrial, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: ids.yn, value: true }] }),
      ]);
      expect((await complete(p.token, sessionId)).status).toBe(200);
    }
    const third = await startSession(p.token, experimentId);
    expect(third.status).toBe(403);
    expect(third.body.error.message).toMatch(/maximum/i);
  });
});

describe('Event ingestion', () => {
  let researcherToken: string;
  let experimentId: string;
  let ids: ReturnType<typeof simpleDefinition>['ids'];

  beforeAll(async () => {
    researcherToken = (await createResearcher()).token;
    const def = simpleDefinition();
    ids = def.ids;
    experimentId = (await publishedExperiment(researcherToken, def.definition)).experimentId;
  });

  async function newSession() {
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    return { token: p.token, sessionId: s.body.session.id as string };
  }

  it('rejects unknown trials, wrong positions, invalid values and missing required responses', async () => {
    const { token, sessionId } = await newSession();
    const expect400 = async (e: unknown) => {
      const res = await ingest(token, sessionId, [e]);
      expect(res.status).toBe(400);
      return res.body.error.message as string;
    };

    expect(await expect400(event({ trialId: 'no-such-trial', trialSequence: 0, advanceReason: 'continue' }))).toMatch(/unknown trial/);
    expect(await expect400(event({ trialId: ids.kbTrial, trialSequence: 0, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'a' }] }))).toMatch(/position/);
    expect(await expect400(event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'z' }] }))).toMatch(/not allowed/);
    expect(await expect400(event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [] }))).toMatch(/required/);
    expect(await expect400(event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'timeout' }))).toMatch(/not possible/);
    expect(await expect400(event({ trialId: ids.ynTrial, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: ids.yn, value: 'yes' }] }))).toMatch(/boolean/);
    expect(await prisma.trialResponse.count({ where: { sessionId } })).toBe(0);
  });

  it('computes correctness on the server and ignores retried/duplicate events', async () => {
    const { token, sessionId } = await newSession();
    const intro = event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue', reactionTimeMs: null });
    const kb = { ...event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'l' }] }), correct: true };

    const first = await ingest(token, sessionId, [intro, kb]);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ingested: 2, duplicates: 0 });

    // Network retry of the same batch.
    expect((await ingest(token, sessionId, [intro, kb])).body).toMatchObject({ ingested: 0, duplicates: 2 });
    // A second, different event for an already recorded trial is not stored twice.
    const again = event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'a' }] });
    expect((await ingest(token, sessionId, [again])).body).toMatchObject({ ingested: 0, duplicates: 1 });

    const stored = await prisma.trialResponse.findMany({ where: { sessionId }, orderBy: { trialSequence: 'asc' } });
    expect(stored).toHaveLength(2);
    // "l" is wrong even though the client claimed correct: true.
    expect(stored[1].correct).toBe(false);
    expect(stored[1].condition).toBe('A');
    expect(stored[0].correct).toBeNull();
  });

  it('refuses events for someone else’s session', async () => {
    const { sessionId } = await newSession();
    const intruder = await createParticipant();
    const res = await ingest(intruder.token, sessionId, [event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue' })]);
    expect(res.status).toBe(403);
  });

  it('returns progress so a reloaded page resumes after the last recorded trial', async () => {
    const p = await createParticipant();
    const key = `resume-${unique()}`;
    const s = await startSession(p.token, experimentId, key);
    await ingest(p.token, s.body.session.id, [event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue' })]);
    const resumed = await startSession(p.token, experimentId, key);
    expect(resumed.body.progress.recordedTrialIds).toEqual([ids.intro]);
  });
});

describe('Completion, reward and rating', () => {
  it('refuses to complete until every trial is recorded', async () => {
    const researcher = await createResearcher();
    const { definition, ids } = simpleDefinition();
    const { experimentId } = await publishedExperiment(researcher.token, definition, { rewardPoints: 10 });
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const sessionId = s.body.session.id;

    const early = await complete(p.token, sessionId);
    expect(early.status).toBe(409);
    expect(early.body.error).toMatchObject({ code: 'SESSION_INCOMPLETE', details: { missingTrials: 3 } });
    const profile = await prisma.participantProfile.findUniqueOrThrow({ where: { id: p.profileId } });
    expect(profile.totalRewardPoints).toBe(0);

    await ingest(p.token, sessionId, [
      event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue', reactionTimeMs: null }),
      event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'a' }], reactionTimeMs: 480 }),
      event({ trialId: ids.ynTrial, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: ids.yn, value: true }], reactionTimeMs: 620 }),
    ]);

    // Concurrent completion requests must award the reward exactly once.
    const results = await Promise.all([1, 2, 3].map(() => complete(p.token, sessionId)));
    for (const r of results) expect(r.status).toBe(200);
    expect(results[0].body).toMatchObject({ rewardPoints: 10, qualityStatus: 'CLEAN' });

    const after = await prisma.participantProfile.findUniqueOrThrow({ where: { id: p.profileId } });
    expect(after.totalRewardPoints).toBe(10);
    expect(after.completedSessionsCount).toBe(1);
    expect(after.qualityRating).toBe(1210);
    expect(await prisma.experimentReward.count({ where: { sessionId } })).toBe(1);
    const events = await prisma.participantRatingEvent.findMany({ where: { sessionId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ reason: 'EXPERIMENT_COMPLETION', delta: 10, oldRating: 1200, newRating: 1210 });

    // No events accepted after completion.
    expect((await ingest(p.token, sessionId, [event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue' })])).status).toBe(409);
  });

  it('applies auditable penalties instead of the gain when quality rules trigger', async () => {
    const researcher = await createResearcher();
    const kbTrials = Array.from({ length: 8 }, (_, i) => {
      const kb = element('KEYBOARD_PRESS');
      kb.config.allowedKeys = ['a', 'l'];
      return trial(`K${i}`, 'response', [kb]);
    });
    const { experimentId } = await publishedExperiment(researcher.token, { ...createEmptyDefinition(), trials: kbTrials }, { rewardPoints: 5 });
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const sessionId = s.body.session.id;

    await ingest(
      p.token,
      sessionId,
      kbTrials.map((t, i) => event({ trialId: t.id, trialSequence: i, advanceReason: 'response', elements: [{ elementId: t.elements[0].id, value: 'a', rtMs: 40 }], reactionTimeMs: 40 }))
    );
    const done = await complete(p.token, sessionId);
    expect(done.status).toBe(200);
    expect(done.body.qualityStatus).toBe('FLAGGED');
    expect(done.body.qualitySignals.sort()).toEqual(['EXTREMELY_FAST_RESPONSES', 'REPEATED_IDENTICAL_RESPONSES']);

    const events = await prisma.participantRatingEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.reason).sort()).toEqual(['EXTREMELY_FAST_RESPONSE', 'REPEATED_IDENTICAL_RESPONSES']);
    for (const e of events) {
      expect(e.delta).toBeLessThan(0);
      expect(e.metadata).toBeTruthy();
    }
    const profile = await prisma.participantProfile.findUniqueOrThrow({ where: { id: p.profileId } });
    expect(profile.qualityRating).toBe(1200 - 15 - 10);
    // Reward is still paid for a completed session.
    expect(profile.totalRewardPoints).toBe(5);
  });

  it('lets participants read only their own sessions', async () => {
    const researcher = await createResearcher();
    const { experimentId } = await publishedExperiment(researcher.token, simpleDefinition().definition);
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const other = await createParticipant();
    expect((await request(app).get(`${API}/sessions/${s.body.session.id}`).set('Authorization', `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).get(`${API}/sessions/${s.body.session.id}`).set('Authorization', `Bearer ${p.token}`)).status).toBe(200);
    expect((await request(app).get(`${API}/sessions/${s.body.session.id}`).set('Authorization', `Bearer ${researcher.token}`)).status).toBe(200);
    const mine = await request(app).get(`${API}/sessions/me`).set('Authorization', `Bearer ${p.token}`);
    expect(mine.body).toHaveLength(1);
  });
});
