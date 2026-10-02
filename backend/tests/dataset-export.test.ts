import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { API, complete, createParticipant, createResearcher, element, event, ingest, publishedExperiment, startSession, trial } from './helpers';
import { createEmptyDefinition } from '../src/shared/experiment';

function quiz() {
  const activity = element('MULTIPLE_CHOICE');
  activity.config.prompt = 'Which activity takes up most of your free time?';
  activity.config.options = [
    { id: 'o-social', label: 'Social media' },
    { id: 'o-gaming', label: 'Gaming' },
    { id: 'o-study', label: 'Studying' },
  ];
  activity.scoring = { enabled: true, correctOptionIds: ['o-study'] };
  const age = element('TEXT_INPUT');
  age.config.prompt = 'Age';
  const ageAgain = element('YES_NO');
  ageAgain.config.prompt = 'Age';
  const trials = [trial('Activity', 'response', [activity]), trial('Age', 'response', [age]), trial('Adult', 'response', [ageAgain])];
  return { definition: { ...createEmptyDefinition(), trials }, trials, activity, age, ageAgain };
}

async function download(token: string, experimentId: string, format: 'CSV' | 'XLSX' | 'JSON', filters: object) {
  const job = await request(app).post(`${API}/exports`).set('Authorization', `Bearer ${token}`).send({ experimentId, format, filters });
  expect(job.status).toBe(202);
  expect(job.body.status).toBe('READY');
  const file = await request(app)
    .get(`${API}/exports/${job.body.id}/download`)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  expect(file.status).toBe(200);
  return { fileName: job.body.fileName as string, data: file.body as Buffer };
}

describe('Dataset export (one row per submission)', () => {
  let token: string;
  let experimentId: string;

  beforeAll(async () => {
    const researcher = await createResearcher();
    token = researcher.token;
    const q = quiz();
    ({ experimentId } = await publishedExperiment(token, q.definition, { visibility: 'PUBLIC', allowGuests: true }));

    const answer = async (pToken: string, choice: string, ageText: string, adult: boolean) => {
      const s = await startSession(pToken, experimentId);
      expect(s.status).toBe(201);
      const res = await ingest(pToken, s.body.session.id, [
        event({ trialId: q.trials[0].id, trialSequence: 0, advanceReason: 'response', elements: [{ elementId: q.activity.id, value: choice }] }),
        event({ trialId: q.trials[1].id, trialSequence: 1, advanceReason: 'submit', elements: [{ elementId: q.age.id, value: ageText }] }),
        event({ trialId: q.trials[2].id, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: q.ageAgain.id, value: adult }] }),
      ]);
      expect(res.status).toBe(200);
      expect((await complete(pToken, s.body.session.id)).status).toBe(200);
      return s.body.session.id as string;
    };
    const member = await createParticipant();
    await answer(member.token, 'o-study', '20', true);
    const guest = await request(app).post(`${API}/auth/guest`);
    await answer(guest.body.accessToken, 'o-gaming', '=1+1', false);
  });

  it('stores a form_submissions row in the completion transaction', async () => {
    const rows = await prisma.formSubmission.findMany({ where: { experimentId }, orderBy: { submittedAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.participantType)).toEqual(['registered', 'guest']);
    expect(rows[0]).toMatchObject({ score: 1, maxScore: 1, versionNumber: 1 });
    expect(rows[0].answers).toEqual([
      expect.objectContaining({ question: 'Which activity takes up most of your free time?', answer: 'Studying' }),
      expect.objectContaining({ question: 'Age', answer: '20' }),
      expect.objectContaining({ question: 'Age', answer: 'Yes' }),
    ]);
  });

  it('CSV: headings are the questions, plus participant id and type; the long export is unchanged', async () => {
    const { data, fileName } = await download(token, experimentId, 'CSV', { layout: 'dataset' });
    expect(fileName).toMatch(/^dataset_/);
    const lines = data.toString('utf8').replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Timestamp (UTC),participant_id,participant_type,duration_seconds,Score,Which activity takes up most of your free time?,Age,Age [Adult]');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,P-[^,]+,registered,[\d.]+,1 \/ 1,Studying,20,Yes$/);
    // Participant text that looks like a formula is neutralised.
    expect(lines[2]).toMatch(/,guest,[\d.]+,0 \/ 1,Gaming,'=1\+1,No$/);

    const long = await download(token, experimentId, 'CSV', {});
    expect(long.data.toString('utf8').replace(/^\uFEFF/, '').split('\r\n')[0]).toMatch(/^participant_id,participant_type,session_id,/);
  });

  it('XLSX: a "Form responses" sheet and an "About this file" sheet naming the source table', async () => {
    const { data } = await download(token, experimentId, 'XLSX', { layout: 'dataset' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Form responses')!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(1).getCell(6).value).toBe('Which activity takes up most of your free time?');
    expect(sheet.getRow(2).getCell(1).value).toBeInstanceOf(Date);
    expect(sheet.getRow(3).getCell(3).value).toBe('guest');
    const about = wb.getWorksheet('About this file')!;
    const text = about.getSheetValues().flat().join(' ');
    expect(text).toContain('form_submissions');
  });

  it('JSON: rows keyed by heading', async () => {
    const { data } = await download(token, experimentId, 'JSON', { layout: 'dataset' });
    const doc = JSON.parse(data.toString('utf8'));
    expect(doc.source_table).toBe('form_submissions');
    expect(doc.rows[1]).toMatchObject({ participant_type: 'guest', 'Which activity takes up most of your free time?': 'Gaming', 'Age [Adult]': 'No' });
  });

  it('backfills rows for sessions completed before the table existed', async () => {
    await prisma.formSubmission.deleteMany({ where: { experimentId } });
    const { data } = await download(token, experimentId, 'CSV', { layout: 'dataset' });
    expect(data.toString('utf8').trim().split('\r\n')).toHaveLength(3);
    expect(await prisma.formSubmission.count({ where: { experimentId } })).toBe(2);
  });
});

describe('Guests: one attempt per device', () => {
  it('returns the same guest to the same device, which cannot take the study again', async () => {
    const researcher = await createResearcher();
    const q = quiz();
    const { experimentId } = await publishedExperiment(researcher.token, q.definition, { visibility: 'PUBLIC', allowGuests: true, attemptPolicy: 'ALLOW_MULTIPLE_ATTEMPTS', maxAttempts: 5 });

    const first = await request(app).post(`${API}/auth/guest`);
    expect(first.status).toBe(201);
    const deviceToken = first.body.deviceToken as string;
    const deviceCookie = (first.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('guest_device='))!;
    expect(deviceCookie).toMatch(/HttpOnly/i);

    const s = await startSession(first.body.accessToken, experimentId);
    await ingest(first.body.accessToken, s.body.session.id, [
      event({ trialId: q.trials[0].id, trialSequence: 0, advanceReason: 'response', elements: [{ elementId: q.activity.id, value: 'o-social' }] }),
      event({ trialId: q.trials[1].id, trialSequence: 1, advanceReason: 'submit', elements: [{ elementId: q.age.id, value: '19' }] }),
      event({ trialId: q.trials[2].id, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: q.ageAgain.id, value: true }] }),
    ]);
    expect((await complete(first.body.accessToken, s.body.session.id)).status).toBe(200);

    // "End guest visit", then "Continue as guest" again: by cookie, and by the stored copy alone.
    await request(app).post(`${API}/auth/logout`).set('Authorization', `Bearer ${first.body.accessToken}`).send({ refreshToken: first.body.refreshToken });
    const byCookie = await request(app).post(`${API}/auth/guest`).set('Cookie', deviceCookie.split(';')[0]);
    const byStorage = await request(app).post(`${API}/auth/guest`).send({ deviceToken });
    expect(byCookie.body.user.id).toBe(first.body.user.id);
    expect(byStorage.body.user.id).toBe(first.body.user.id);

    const elig = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${byStorage.body.accessToken}`);
    expect(elig.body).toMatchObject({ eligible: false, code: 'ATTEMPT_LIMIT_REACHED' });
    expect(elig.body.reason).toMatch(/from this device/);
    expect((await startSession(byStorage.body.accessToken, experimentId)).status).toBe(403);

    // A different device is a different guest; a registered participant may repeat (5 attempts allowed).
    const other = await request(app).post(`${API}/auth/guest`);
    expect(other.body.user.id).not.toBe(first.body.user.id);
    const member = await createParticipant();
    const m = await request(app).get(`${API}/experiments/${experimentId}/eligibility`).set('Authorization', `Bearer ${member.token}`);
    expect(m.body.attempts.maxAttempts).toBe(5);
  });

  it('ignores malformed device tokens', async () => {
    const res = await request(app).post(`${API}/auth/guest`).send({ deviceToken: 'short' });
    expect(res.status).toBe(201);
    expect(res.body.deviceToken).not.toBe('short');
    expect(res.body.deviceToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
});
