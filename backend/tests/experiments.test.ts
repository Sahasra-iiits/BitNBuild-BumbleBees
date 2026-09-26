// ==============================================================================
// SynapseLab — Experiment & Session Tests
// ==============================================================================

import request from 'supertest';
import { app } from '../src/app';

const API_PREFIX = '/api/v1';

// Helper to create a researcher and get token
async function createResearcher() {
  const email = `researcher-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email,
      password: 'ValidPass123',
      role: 'RESEARCHER',
      researcherProfile: { institution: 'Test Lab' },
    });
  return { token: res.body.accessToken, user: res.body.user };
}

// Helper to create a participant and get token
async function createParticipant(age = 25) {
  const email = `participant-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email,
      password: 'ValidPass123',
      role: 'PARTICIPANT',
      participantProfile: { age },
    });
  return { token: res.body.accessToken, user: res.body.user };
}

describe('Experiment API', () => {
  let researcherToken: string;

  beforeAll(async () => {
    const r = await createResearcher();
    researcherToken = r.token;
  });

  describe('POST /experiments', () => {
    it('should create a draft experiment', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          title: 'Test Experiment',
          description: 'A test experiment',
          visibility: 'PRIVATE',
          rewardPoints: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Experiment');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.visibility).toBe('PRIVATE');
    });

    it('should reject reward points over 20', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          title: 'Bad Reward',
          rewardPoints: 25,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Experiment Lifecycle', () => {
    let experimentId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          title: 'Lifecycle Test',
          visibility: 'PUBLIC',
          rewardPoints: 5,
        });
      experimentId = res.body.id;
    });

    it('should publish a draft experiment', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/publish`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PUBLISHED');
    });

    it('should pause a published experiment', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/pause`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAUSED');
    });

    it('should not archive a paused experiment (must close first)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/archive`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(409);
    });

    it('should close a paused experiment', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/close`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CLOSED');
    });

    it('should archive a closed experiment', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/experiments/${experimentId}/archive`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ARCHIVED');
    });
  });

  describe('Experiment Ownership', () => {
    it('should prevent non-owner from modifying experiment', async () => {
      // Create experiment with first researcher
      const r1 = await createResearcher();
      const expRes = await request(app)
        .post(`${API_PREFIX}/experiments`)
        .set('Authorization', `Bearer ${r1.token}`)
        .send({ title: 'Owned Experiment' });

      // Try to update with second researcher
      const r2 = await createResearcher();
      const res = await request(app)
        .patch(`${API_PREFIX}/experiments/${expRes.body.id}`)
        .set('Authorization', `Bearer ${r2.token}`)
        .send({ title: 'Stolen Experiment' });

      expect(res.status).toBe(403);
    });
  });

  describe('Public Listing', () => {
    it('should list public experiments without auth', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/experiments/public`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('should not expose private experiment metadata in public listing', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/experiments/public`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        const exp = res.body.data[0];
        expect(exp).not.toHaveProperty('eligibilityRules');
        expect(exp).not.toHaveProperty('versions');
      }
    });
  });
});

describe('Eligibility', () => {
  it('should check eligibility with age restrictions', async () => {
    const researcher = await createResearcher();
    const participant = await createParticipant(16); // Young participant

    // Create experiment with age restriction (18+)
    const expRes = await request(app)
      .post(`${API_PREFIX}/experiments`)
      .set('Authorization', `Bearer ${researcher.token}`)
      .send({
        title: 'Age Restricted',
        visibility: 'PUBLIC',
        eligibilityRules: [
          { ruleType: 'AGE_RANGE', minAge: 18, maxAge: 65 },
        ],
      });

    // Publish it
    await request(app)
      .post(`${API_PREFIX}/experiments/${expRes.body.id}/publish`)
      .set('Authorization', `Bearer ${researcher.token}`);

    // Check eligibility
    const eligRes = await request(app)
      .get(`${API_PREFIX}/experiments/${expRes.body.id}/eligibility`)
      .set('Authorization', `Bearer ${participant.token}`);

    expect(eligRes.status).toBe(200);
    expect(eligRes.body.eligible).toBe(false);
  });
});

describe('Sessions and Events', () => {
  it('should prevent starting session for unpublished experiment', async () => {
    const researcher = await createResearcher();
    const participant = await createParticipant();

    const expRes = await request(app)
      .post(`${API_PREFIX}/experiments`)
      .set('Authorization', `Bearer ${researcher.token}`)
      .send({ title: 'Unpublished' });

    const res = await request(app)
      .post(`${API_PREFIX}/sessions/experiments/${expRes.body.id}/sessions`)
      .set('Authorization', `Bearer ${participant.token}`);

    // Should fail because experiment is not published
    expect([403, 409]).toContain(res.status);
  });
});

describe('Error Format', () => {
  it('should return consistent error format', async () => {
    const res = await request(app)
      .get(`${API_PREFIX}/experiments/non-existent-id`);

    expect(res.status).toBe(401); // Not authenticated
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app)
      .get(`${API_PREFIX}/nonexistent-endpoint`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
