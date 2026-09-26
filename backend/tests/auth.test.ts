// ==============================================================================
// SynapseLab — Auth Tests
// ==============================================================================

import request from 'supertest';
import { app } from '../src/app';

const API_PREFIX = '/api/v1';

describe('Authentication API', () => {
  // ===========================================================================
  // Registration
  // ===========================================================================
  describe('POST /auth/register', () => {
    it('should register a researcher with valid data', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `test-researcher-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'RESEARCHER',
          researcherProfile: {
            institution: 'Test University',
            department: 'Psychology',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.role).toBe('RESEARCHER');
      expect(res.body.user.email).toContain('test-researcher');
      // Must never return password hash
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should register a participant with valid data', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `test-participant-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'PARTICIPANT',
          participantProfile: {
            age: 25,
            gender: 'Female',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('PARTICIPANT');
      expect(res.body.user.participantProfile).toHaveProperty('pseudonymousId');
      expect(res.body.user.participantProfile.qualityRating).toBe(1200);
      expect(res.body.user.participantProfile.completedSessionsCount).toBe(0);
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'weak@test.com',
          password: 'weak',
          role: 'RESEARCHER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration', async () => {
      const email = `dup-${Date.now()}@test.com`;

      await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should require participant profile for participant role', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `no-profile-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'PARTICIPANT',
        });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // Login
  // ===========================================================================
  describe('POST /auth/login', () => {
    const testEmail = `login-test-${Date.now()}@test.com`;

    beforeAll(async () => {
      await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: testEmail,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: testEmail,
          password: 'ValidPass123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testEmail);
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: testEmail,
          password: 'WrongPassword1',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'nobody@test.com',
          password: 'ValidPass123',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Token Refresh
  // ===========================================================================
  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const registerRes = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `refresh-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({
          refreshToken: registerRes.body.refreshToken,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({
          refreshToken: 'invalid-token',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Get Current User
  // ===========================================================================
  describe('GET /auth/me', () => {
    it('should return current user with valid access token', async () => {
      const registerRes = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `me-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });

      const res = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('role');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without auth token', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/auth/me`);

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Logout
  // ===========================================================================
  describe('POST /auth/logout', () => {
    it('should logout and revoke session', async () => {
      const registerRes = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `logout-${Date.now()}@test.com`,
          password: 'ValidPass123',
          role: 'RESEARCHER',
        });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
        .send({ refreshToken: registerRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out');
    });
  });
});

// ===========================================================================
// Authorization Tests
// ===========================================================================
describe('Authorization', () => {
  it('should prevent participant from accessing researcher endpoints', async () => {
    const participantRes = await request(app)
      .post(`${API_PREFIX}/auth/register`)
      .send({
        email: `auth-part-${Date.now()}@test.com`,
        password: 'ValidPass123',
        role: 'PARTICIPANT',
        participantProfile: { age: 25 },
      });

    const res = await request(app)
      .get(`${API_PREFIX}/experiments`)
      .set('Authorization', `Bearer ${participantRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('should prevent researcher from accessing participant endpoints', async () => {
    const researcherRes = await request(app)
      .post(`${API_PREFIX}/auth/register`)
      .send({
        email: `auth-res-${Date.now()}@test.com`,
        password: 'ValidPass123',
        role: 'RESEARCHER',
      });

    const res = await request(app)
      .get(`${API_PREFIX}/quality/participants/me/rating`)
      .set('Authorization', `Bearer ${researcherRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });
});
