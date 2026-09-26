import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { csvCell } from '../src/modules/exports/export-rows';
import { detectMediaType } from '../src/modules/assets/file-type';
import {
  API,
  complete,
  createExperiment,
  createParticipant,
  createResearcher,
  element,
  event,
  ingest,
  publishedExperiment,
  saveDraft,
  simpleDefinition,
  startSession,
  trial,
} from './helpers';
import { createEmptyDefinition } from '../src/shared/experiment';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function wav(): Buffer {
  const samples = 800;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8, 'latin1');
  buf.write('fmt ', 12, 'latin1');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36, 'latin1');
  buf.writeUInt32LE(samples, 40);
  return buf;
}

describe('File type detection', () => {
  it('identifies media by content, not by name', () => {
    expect(detectMediaType(PNG)).toEqual({ kind: 'IMAGE', mimeType: 'image/png' });
    expect(detectMediaType(wav())).toEqual({ kind: 'AUDIO', mimeType: 'audio/wav' });
    expect(detectMediaType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectMediaType(Buffer.from('<html><body>hi</body></html>'))).toBeNull();
  });
});

describe('Assets', () => {
  let token: string;
  let experimentId: string;
  beforeAll(async () => {
    token = (await createResearcher()).token;
    experimentId = (await createExperiment(token)).id;
  });

  const upload = (buf: Buffer, name: string, t = token, exp = experimentId) =>
    request(app).post(`${API}/experiments/${exp}/assets`).set('Authorization', `Bearer ${t}`).attach('file', buf, name);

  it('uploads an image, persists it and serves it back byte-for-byte to the owner', async () => {
    const res = await upload(PNG, 'stim.png');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'IMAGE', mimeType: 'image/png', sizeBytes: PNG.length, originalName: 'stim.png' });

    const content = await request(app).get(`${API}/assets/${res.body.id}/content`).set('Authorization', `Bearer ${token}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toBe('image/png');
    expect(content.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(content.body as Buffer, PNG)).toBe(0);

    const list = await request(app).get(`${API}/experiments/${experimentId}/assets`).set('Authorization', `Bearer ${token}`);
    expect(list.body.map((a: { id: string }) => a.id)).toContain(res.body.id);
  });

  it('uploads audio', async () => {
    const res = await upload(wav(), 'tone.wav');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'AUDIO', mimeType: 'audio/wav' });
  });

  it('rejects corrupted, disguised and empty files', async () => {
    expect((await upload(Buffer.from('not really a png at all'), 'fake.png')).status).toBe(400);
    expect((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'x.svg')).status).toBe(400);
    const noFile = await request(app).post(`${API}/experiments/${experimentId}/assets`).set('Authorization', `Bearer ${token}`);
    expect(noFile.status).toBe(400);
  });

  it('rejects images over the size limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]);
    const res = await upload(big, 'big.png');
    expect(res.status).toBe(413);
  });

  it('does not let other researchers upload to or read the experiment’s assets', async () => {
    const other = await createResearcher();
    expect((await upload(PNG, 'x.png', other.token)).status).toBe(403);
    const mine = await upload(PNG, 'mine.png');
    expect((await request(app).get(`${API}/assets/${mine.body.id}/content`).set('Authorization', `Bearer ${other.token}`)).status).toBe(404);
    const participant = await createParticipant();
    // Draft experiment: participants cannot read its files.
    expect((await request(app).get(`${API}/assets/${mine.body.id}/content`).set('Authorization', `Bearer ${participant.token}`)).status).toBe(404);
  });

  it('lets participants load assets of a published experiment, and validation accepts the reference', async () => {
    const exp = await createExperiment(token);
    const asset = await upload(PNG, 'stim.png', token, exp.id);
    const img = element('IMAGE_VISUAL');
    img.config.assetId = asset.body.id;
    img.config.assetName = 'stim.png';
    img.config.altText = 'a stimulus';
    await saveDraft(token, exp.id, { ...createEmptyDefinition(), trials: [trial('Img', 'manual', [img])] });
    expect((await request(app).post(`${API}/experiments/${exp.id}/publish`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
    const participant = await createParticipant();
    expect((await request(app).get(`${API}/assets/${asset.body.id}/content`).set('Authorization', `Bearer ${participant.token}`)).status).toBe(200);
  });
});

describe('Results and exports', () => {
  let token: string;
  let experimentId: string;
  let versionId: string;
  let ids: ReturnType<typeof simpleDefinition>['ids'];

  beforeAll(async () => {
    token = (await createResearcher()).token;
    const def = simpleDefinition();
    ids = def.ids;
    ({ experimentId, versionId } = await publishedExperiment(token, def.definition, { rewardPoints: 3 }));

    // Participant 1: both correct. Participant 2: keyboard wrong, yes/no correct. Participant 3: excluded.
    const answers: Array<[string, boolean, number, number]> = [
      ['a', true, 400, 600],
      ['l', true, 800, 1000],
      ['a', false, 300, 300],
    ];
    for (const [i, [key, yes, rt1, rt2]] of answers.entries()) {
      const p = await createParticipant();
      const s = await startSession(p.token, experimentId);
      const sessionId = s.body.session.id;
      await ingest(p.token, sessionId, [
        event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue', reactionTimeMs: null }),
        event({ trialId: ids.kbTrial, trialSequence: 1, advanceReason: 'response', elements: [{ elementId: ids.kb, value: key, rtMs: rt1 }], reactionTimeMs: rt1 }),
        event({ trialId: ids.ynTrial, trialSequence: 2, advanceReason: 'response', elements: [{ elementId: ids.yn, value: yes, rtMs: rt2 }], reactionTimeMs: rt2 }),
      ]);
      await complete(p.token, sessionId);
      if (i === 2) {
        const excl = await request(app).post(`${API}/quality/exclude`).set('Authorization', `Bearer ${token}`).send({ sessionId, reason: 'Did not follow instructions' });
        expect(excl.status).toBe(200);
      }
    }
  });

  it('computes aggregates from the recorded, non-excluded data only', async () => {
    const res = await request(app).get(`${API}/results/experiments/${experimentId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ participants: 3, totalSessions: 3, completedSessions: 2, excludedSessions: 1 });
    const a = res.body.conditions.find((c: { condition: string }) => c.condition === 'A');
    const b = res.body.conditions.find((c: { condition: string }) => c.condition === 'B');
    expect(a).toMatchObject({ n: 2, meanRt: 600, medianRt: 600, accuracy: 50, scoredCount: 2 });
    expect(b).toMatchObject({ n: 2, meanRt: 800, accuracy: 100 });
    expect(a.sdRt).toBeCloseTo(282.84, 1);
    // The instruction trial (no response) is not part of RT/accuracy statistics.
    expect(res.body.conditions.find((c: { condition: string }) => c.condition === 'Unlabeled')).toBeUndefined();
  });

  it('returns paginated raw data and honors includeExcluded=false', async () => {
    const res = await request(app).get(`${API}/results/experiments/${experimentId}/data?limit=2&offset=0`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    expect(res.body.data).toHaveLength(2);
    const all = await request(app).get(`${API}/results/experiments/${experimentId}/data?includeExcluded=true`).set('Authorization', `Bearer ${token}`);
    expect(all.body.total).toBe(9);
    const notAll = await request(app).get(`${API}/results/experiments/${experimentId}/data?includeExcluded=false`).set('Authorization', `Bearer ${token}`);
    expect(notAll.body.total).toBe(6);
  });

  async function exportAndDownload(format: 'CSV' | 'XLSX' | 'JSON', filters?: object) {
    const job = await request(app).post(`${API}/exports`).set('Authorization', `Bearer ${token}`).send({ experimentId, format, filters });
    expect(job.status).toBe(202);
    expect(job.body.status).toBe('READY');
    expect(job.body).not.toHaveProperty('filePath');
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
    return { job: job.body, data: file.body as Buffer };
  }

  it('exports tidy CSV with one row per response and no excluded data by default', async () => {
    const { data } = await exportAndDownload('CSV');
    const lines = data.toString('utf8').replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].split(',')).toContain('trial_rt_ms');
    // 2 sessions x (1 instruction row + 1 keyboard row + 1 yes/no row)
    expect(lines).toHaveLength(1 + 6);
    expect(data.toString('utf8')).toContain(',KEYBOARD_PRESS,a,A,');
  });

  it('exports JSON (BigInt timestamps serialized) including excluded data when asked, filtered by version', async () => {
    const { data } = await exportAndDownload('JSON', { includeExcluded: true, versionId });
    const doc = JSON.parse(data.toString('utf8'));
    expect(doc.sessions).toHaveLength(3);
    expect(typeof doc.sessions[0].trials[0].stimulus_onset_epoch_ms).toBe('number');
    expect(doc.filters).toEqual({ include_excluded: true, version_id: versionId });
  });

  it('exports an Excel workbook with a codebook', async () => {
    const { data } = await exportAndDownload('XLSX');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as unknown as ArrayBuffer);
    expect(wb.getWorksheet('responses')!.rowCount).toBe(7);
    expect(wb.getWorksheet('codebook')!.rowCount).toBeGreaterThan(10);
  });

  it('does not let another researcher download the export', async () => {
    const job = await request(app).post(`${API}/exports`).set('Authorization', `Bearer ${token}`).send({ experimentId, format: 'CSV' });
    const other = await createResearcher();
    expect((await request(app).get(`${API}/exports/${job.body.id}/download`).set('Authorization', `Bearer ${other.token}`)).status).toBe(404);
    expect((await request(app).post(`${API}/exports`).set('Authorization', `Bearer ${other.token}`).send({ experimentId, format: 'CSV' })).status).toBe(403);
  });

  it('escapes CSV cells and neutralizes spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(true)).toBe('TRUE');
    expect(csvCell(null)).toBe('');
  });
});

describe('Quality flags', () => {
  it('applies a researcher penalty only after confirmation, once, and only to their own participants', async () => {
    const researcher = await createResearcher();
    const { definition, ids } = simpleDefinition();
    const { experimentId } = await publishedExperiment(researcher.token, definition);
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const sessionId = s.body.session.id;
    await ingest(p.token, sessionId, [event({ trialId: ids.intro, trialSequence: 0, advanceReason: 'continue' })]);

    const auth = { Authorization: `Bearer ${researcher.token}` };
    const flag = await request(app).post(`${API}/quality/flags`).set(auth).send({ sessionId, reason: 'Inattentive', description: 'Answered before stimuli appeared on many trials.' });
    expect(flag.status).toBe(201);
    expect(flag.body).not.toHaveProperty('participantId');
    expect((await prisma.participantProfile.findUniqueOrThrow({ where: { id: p.profileId } })).qualityRating).toBe(1200);

    // Unsupported flags are rejected: a description (evidence) is required.
    expect((await request(app).post(`${API}/quality/flags`).set(auth).send({ sessionId, reason: 'x', description: 'short' })).status).toBe(400);
    // A different researcher cannot flag this participant.
    const other = await createResearcher();
    expect((await request(app).post(`${API}/quality/flags`).set('Authorization', `Bearer ${other.token}`).send({ sessionId, reason: 'x', description: 'long enough description' })).status).toBe(403);

    expect((await request(app).post(`${API}/quality/flags/${flag.body.id}/review`).set(auth).send({ status: 'CONFIRMED', ratingPenalty: 500 })).status).toBe(400);
    const confirmed = await request(app).post(`${API}/quality/flags/${flag.body.id}/review`).set(auth).send({ status: 'CONFIRMED', ratingPenalty: 20, note: 'Verified in raw data' });
    expect(confirmed.status).toBe(200);
    expect((await request(app).post(`${API}/quality/flags/${flag.body.id}/review`).set(auth).send({ status: 'CONFIRMED', ratingPenalty: 20 })).status).toBe(409);

    const profile = await prisma.participantProfile.findUniqueOrThrow({ where: { id: p.profileId } });
    expect(profile.qualityRating).toBe(1180);
    const rating = await request(app).get(`${API}/quality/participants/me/rating`).set('Authorization', `Bearer ${p.token}`);
    expect(rating.body.history[0]).toMatchObject({ reason: 'RESEARCHER_QUALITY_FLAG', delta: -20, source: 'RESEARCHER' });
  });
});
