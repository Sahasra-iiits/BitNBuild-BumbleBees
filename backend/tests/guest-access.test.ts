import request from 'supertest';
import { app } from '../src/app';
import { API, complete, createParticipant, createResearcher, event, ingest, publishedExperiment, simpleDefinition, startSession } from './helpers';

async function createGuest() {
  const res = await request(app).post(`${API}/auth/guest`);
  expect(res.status).toBe(201);
  return { token: res.body.accessToken as string, user: res.body.user };
}

async function setSettings(token: string, experimentId: string, body: Record<string, unknown>) {
  return request(app).patch(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${token}`).send(body);
}

async function listPublic(token?: string) {
  const req = request(app).get(`${API}/experiments/public?limit=100`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req;
  expect(res.status).toBe(200);
  return (res.body.data as Array<{ id: string; allowGuests: boolean }>).map((e) => e.id);
}

describe('Guest participants', () => {
  it('creates a guest without email, password or age, who cannot sign in with a password', async () => {
    const guest = await createGuest();
    expect(guest.user).toMatchObject({ role: 'PARTICIPANT', isGuest: true });
    expect(guest.user.participantProfile.age).toBeNull();
    expect(guest.user.email).toMatch(/@guest\.invalid$/);

    const me = await request(app).get(`${API}/auth/me`).set('Authorization', `Bearer ${guest.token}`);
    expect(me.body.isGuest).toBe(true);

    const login = await request(app).post(`${API}/auth/login`).send({ email: guest.user.email, password: 'anything-at-all' });
    expect(login.status).toBe(401);
  });

  it('only lets guests take public experiments the researcher opened to guests', async () => {
    const researcher = await createResearcher();
    const { definition, ids } = simpleDefinition();
    const open = await publishedExperiment(researcher.token, definition, { visibility: 'PUBLIC', allowGuests: true });
    const publicOnly = await publishedExperiment(researcher.token, simpleDefinition().definition, { visibility: 'PUBLIC' });
    const privateExp = await publishedExperiment(researcher.token, simpleDefinition().definition, { visibility: 'PRIVATE' });
    const guest = await createGuest();

    // Discover: guests see only guest-enabled experiments; registered participants see all public ones.
    const guestList = await listPublic(guest.token);
    expect(guestList).toContain(open.experimentId);
    expect(guestList).not.toContain(publicOnly.experimentId);
    const member = await createParticipant();
    const memberList = await listPublic(member.token);
    expect(memberList).toEqual(expect.arrayContaining([open.experimentId, publicOnly.experimentId]));

    // Eligibility and session start are enforced on the server, not just hidden in the list.
    for (const id of [publicOnly.experimentId, privateExp.experimentId]) {
      const elig = await request(app).get(`${API}/experiments/${id}/eligibility`).set('Authorization', `Bearer ${guest.token}`);
      expect(elig.body).toMatchObject({ eligible: false, code: 'ACCOUNT_REQUIRED' });
      expect((await startSession(guest.token, id)).status).toBe(403);
    }
    expect((await startSession(member.token, publicOnly.experimentId)).status).toBe(201);

    // A guest completes the guest-enabled experiment and the data is stored like anyone else's.
    const s = await startSession(guest.token, open.experimentId);
    expect(s.status).toBe(201);
    const res = await ingest(guest.token, s.body.session.id, [
      event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue' }),
      event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: 'a' }], reactionTimeMs: 400 }),
      event({ trialId: ids.ynTrial, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: ids.yn, value: true }], reactionTimeMs: 500 }),
    ]);
    expect(res.status).toBe(200);
    expect((await complete(guest.token, s.body.session.id)).status).toBe(200);

    // Researchers can tell guest data apart.
    const raw = await request(app).get(`${API}/results/experiments/${open.experimentId}/data`).set('Authorization', `Bearer ${researcher.token}`);
    expect(raw.status).toBe(200);
    expect(raw.body.data.length).toBe(3);
    expect(raw.body.data.every((r: { isGuest: boolean }) => r.isGuest)).toBe(true);
  });

  it('turns guest access off when an experiment becomes private, and rejects guests on private experiments', async () => {
    const researcher = await createResearcher();
    const { experimentId } = await publishedExperiment(researcher.token, simpleDefinition().definition, { visibility: 'PUBLIC', allowGuests: true });

    const priv = await setSettings(researcher.token, experimentId, { visibility: 'PRIVATE' });
    expect(priv.status).toBe(200);
    expect(priv.body.allowGuests).toBe(false);

    const bad = await setSettings(researcher.token, experimentId, { allowGuests: true });
    expect(bad.status).toBe(400);

    const ok = await setSettings(researcher.token, experimentId, { visibility: 'PUBLIC', allowGuests: true });
    expect(ok.body).toMatchObject({ visibility: 'PUBLIC', allowGuests: true });

    // A private experiment created with allowGuests ignores it.
    const created = await request(app).post(`${API}/experiments`).set('Authorization', `Bearer ${researcher.token}`).send({ title: 'x', visibility: 'PRIVATE', allowGuests: true });
    expect(created.body.allowGuests).toBe(false);
  });

  it('asks guests to create an account when the experiment has an age requirement', async () => {
    const researcher = await createResearcher();
    const { experimentId } = await publishedExperiment(researcher.token, simpleDefinition().definition, {
      visibility: 'PUBLIC',
      allowGuests: true,
      eligibilityRules: [{ ruleType: 'AGE_RANGE', minAge: 18 }],
    });
    const guest = await createGuest();
    const elig = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${guest.token}`);
    expect(elig.body).toMatchObject({ eligible: false, code: 'ACCOUNT_REQUIRED' });
    expect(elig.body.reason).toMatch(/age requirement/);
  });
});
