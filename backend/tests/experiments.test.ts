// ==============================================================================
// SynapseLab — Experiment API Tests
// ==============================================================================

import request from 'supertest';
import { app } from '../src/app';
import {
  API,
  createExperiment,
  createParticipant,
  createResearcher,
  publishedExperiment,
  saveDraft,
  simpleDefinition,
  startSession,
} from './helpers';

describe('Experiment API', () => {
  let researcherToken: string;

  beforeAll(async () => {
    researcherToken = (await createResearcher()).token;
  });

  describe('POST /experiments', () => {
    it('creates a draft experiment with an empty draft definition', async () => {
      const res = await request(app)
        .post(`${API}/experiments`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ title: 'Test Experiment', description: 'A test experiment', visibility: 'PRIVATE', rewardPoints: 10 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Test Experiment', status: 'DRAFT', visibility: 'PRIVATE', rewardPoints: 10 });
      expect(res.body).not.toHaveProperty('draftDefinition');

      const draft = await request(app).get(`${API}/experiments/${res.body.id}/draft`).set('Authorization', `Bearer ${researcherToken}`);
      expect(draft.status).toBe(200);
      expect(draft.body).toMatchObject({ revision: 0, source: 'draft', definition: { schemaVersion: 2, trials: [] } });
    });

    it('rejects reward points over 20', async () => {
      const res = await request(app)
        .post(`${API}/experiments`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ title: 'Bad Reward', rewardPoints: 25 });
      expect(res.status).toBe(400);
    });
  });

  describe('Lifecycle', () => {
    let experimentId: string;

    beforeAll(async () => {
      experimentId = (await publishedExperiment(researcherToken, simpleDefinition().definition, { rewardPoints: 5 })).experimentId;
    });

    const post = (action: string) => request(app).post(`${API}/experiments/${experimentId}/${action}`).set('Authorization', `Bearer ${researcherToken}`);

    it('is published', async () => {
      const res = await request(app).get(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${researcherToken}`);
      expect(res.body.status).toBe('PUBLISHED');
      expect(res.body.hasUnpublishedChanges).toBe(false);
    });

    it('pauses and resumes without publishing draft edits', async () => {
      expect((await post('pause')).body.status).toBe('PAUSED');
      expect((await post('resume')).body.status).toBe('PUBLISHED');
      expect((await post('pause')).body.status).toBe('PAUSED');
    });

    it('does not archive before closing', async () => {
      expect((await post('archive')).status).toBe(409);
    });

    it('closes and then archives', async () => {
      expect((await post('close')).body.status).toBe('CLOSED');
      expect((await post('archive')).body.status).toBe('ARCHIVED');
    });

    it('rejects edits to an archived experiment', async () => {
      const res = await request(app).patch(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${researcherToken}`).send({ title: 'x' });
      expect(res.status).toBe(409);
    });
  });

  describe('Settings', () => {
    it('updates visibility, reward, attempts and eligibility rules, also after publishing', async () => {
      const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition);
      const res = await request(app)
        .patch(`${API}/experiments/${experimentId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          visibility: 'PRIVATE',
          rewardPoints: 12,
          attemptPolicy: 'ALLOW_ONE_ATTEMPT',
          eligibilityRules: [
            { ruleType: 'AGE_RANGE', minAge: 18, maxAge: 40 },
            { ruleType: 'RATING_RANGE', minRating: 1100 },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ visibility: 'PRIVATE', rewardPoints: 12, attemptPolicy: 'ALLOW_ONE_ATTEMPT', maxAttempts: 1 });
      expect(res.body.eligibilityRules).toHaveLength(2);

      // Rules are replaced, not appended.
      const again = await request(app)
        .patch(`${API}/experiments/${experimentId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ eligibilityRules: [{ ruleType: 'AGE_RANGE', minAge: 21 }] });
      expect(again.body.eligibilityRules).toHaveLength(1);
    });

    it('rejects inverted eligibility ranges and ratings outside the scale', async () => {
      const exp = await createExperiment(researcherToken);
      const patch = (body: object) => request(app).patch(`${API}/experiments/${exp.id}`).set('Authorization', `Bearer ${researcherToken}`).send(body);
      expect((await patch({ eligibilityRules: [{ ruleType: 'AGE_RANGE', minAge: 50, maxAge: 20 }] })).status).toBe(400);
      expect((await patch({ eligibilityRules: [{ ruleType: 'RATING_RANGE', minRating: 5000 }] })).status).toBe(400);
    });
  });

  describe('Ownership', () => {
    it('prevents another researcher from reading or modifying the experiment', async () => {
      const r1 = await createResearcher();
      const exp = await createExperiment(r1.token);
      const r2 = await createResearcher();
      const auth = { Authorization: `Bearer ${r2.token}` };

      expect((await request(app).patch(`${API}/experiments/${exp.id}`).set(auth).send({ title: 'Stolen' })).status).toBe(403);
      expect((await request(app).get(`${API}/experiments/${exp.id}`).set(auth)).status).toBe(403);
      expect((await request(app).get(`${API}/experiments/${exp.id}/draft`).set(auth)).status).toBe(403);
      expect((await request(app).put(`${API}/experiments/${exp.id}/draft`).set(auth).send({ definition: { trials: [] }, baseRevision: 0 })).status).toBe(403);
      expect((await request(app).post(`${API}/experiments/${exp.id}/publish`).set(auth)).status).toBe(403);
    });
  });

  describe('Participant view', () => {
    it('hides correct answers, eligibility internals and drafts from participants', async () => {
      const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition);
      const participant = await createParticipant();
      const res = await request(app).get(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${participant.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentVersion.versionNumber', 1);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('correctKey');
      expect(res.body).not.toHaveProperty('versions');
      expect(res.body).not.toHaveProperty('eligibilityRules');
      expect(res.body).not.toHaveProperty('researcherId');
    });

    it('returns 404 to participants for unpublished experiments', async () => {
      const exp = await createExperiment(researcherToken);
      const participant = await createParticipant();
      expect((await request(app).get(`${API}/experiments/${exp.id}`).set('Authorization', `Bearer ${participant.token}`)).status).toBe(404);
    });
  });

  describe('Public listing', () => {
    it('lists public experiments without auth and without researcher emails', async () => {
      await publishedExperiment(researcherToken, simpleDefinition().definition);
      const res = await request(app).get(`${API}/experiments/public`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const exp of res.body.data) {
        expect(exp).not.toHaveProperty('eligibilityRules');
        expect(exp).not.toHaveProperty('versions');
        expect(JSON.stringify(exp)).not.toContain('@');
      }
    });
  });

  describe('Delete', () => {
    it('deletes an unpublished draft but not a published experiment', async () => {
      const draft = await createExperiment(researcherToken);
      expect((await request(app).delete(`${API}/experiments/${draft.id}`).set('Authorization', `Bearer ${researcherToken}`)).status).toBe(204);
      const { experimentId } = await publishedExperiment(researcherToken, simpleDefinition().definition);
      expect((await request(app).delete(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${researcherToken}`)).status).toBe(409);
    });
  });
});

describe('Eligibility', () => {
  it('enforces age restrictions', async () => {
    const researcher = await createResearcher();
    const young = await createParticipant(16);
    const adult = await createParticipant(30);
    const { experimentId } = await publishedExperiment(researcher.token, simpleDefinition().definition, {
      eligibilityRules: [{ ruleType: 'AGE_RANGE', minAge: 18, maxAge: 65 }],
    });

    const denied = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${young.token}`);
    expect(denied.body).toMatchObject({ eligible: false, code: 'AGE_NOT_MET' });
    expect((await startSession(young.token, experimentId)).status).toBe(403);

    const allowed = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${adult.token}`);
    expect(allowed.body.eligible).toBe(true);
  });

  it('enforces rating restrictions on the 1200-based scale', async () => {
    const researcher = await createResearcher();
    const participant = await createParticipant();
    const { experimentId } = await publishedExperiment(researcher.token, simpleDefinition().definition, {
      eligibilityRules: [{ ruleType: 'RATING_RANGE', minRating: 1300 }],
    });
    const res = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${participant.token}`);
    expect(res.body).toMatchObject({ eligible: false, code: 'RATING_TOO_LOW' });
  });

  it('prevents starting a session for an unpublished experiment', async () => {
    const researcher = await createResearcher();
    const participant = await createParticipant();
    const exp = await createExperiment(researcher.token);
    await saveDraft(researcher.token, exp.id, simpleDefinition().definition);

    const res = await startSession(participant.token, exp.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EXPERIMENT_NOT_ELIGIBLE');
  });
});

describe('Error format', () => {
  it('returns a consistent error body', async () => {
    const res = await request(app).get(`${API}/experiments/non-existent-id`);
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get(`${API}/nonexistent-endpoint`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports unimplemented password reset honestly', async () => {
    const res = await request(app).post(`${API}/auth/reset-password`).send({ token: 'x', newPassword: 'Abcdefg1' });
    expect(res.status).toBe(501);
  });
});
