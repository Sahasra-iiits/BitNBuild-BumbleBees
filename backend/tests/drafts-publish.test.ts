import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { API, createExperiment, createResearcher, element, publishedExperiment, saveDraft, simpleDefinition, trial } from './helpers';
import { createEmptyDefinition } from '../src/shared/experiment';

describe('Drafts', () => {
  let token: string;
  beforeAll(async () => {
    token = (await createResearcher()).token;
  });

  it('saves, reloads and increments the revision', async () => {
    const exp = await createExperiment(token);
    const { definition } = simpleDefinition();
    const saved = await saveDraft(token, exp.id, definition);
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(1);

    const reloaded = await request(app).get(`${API}/experiments/${exp.id}/draft`).set('Authorization', `Bearer ${token}`);
    expect(reloaded.body.revision).toBe(1);
    expect(reloaded.body.definition.trials.map((t: { id: string }) => t.id)).toEqual(definition.trials.map((t) => t.id));
  });

  it('rejects a stale revision instead of overwriting newer work', async () => {
    const exp = await createExperiment(token);
    const put = (baseRevision: number, name: string) =>
      request(app)
        .put(`${API}/experiments/${exp.id}/draft`)
        .set('Authorization', `Bearer ${token}`)
        .send({ definition: { ...createEmptyDefinition(), trials: [trial(name, 'manual', [])] }, baseRevision });

    expect((await put(0, 'tab A')).status).toBe(200);
    const stale = await put(0, 'tab B');
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: 'DRAFT_CONFLICT', details: { currentRevision: 1 } });

    const draft = await request(app).get(`${API}/experiments/${exp.id}/draft`).set('Authorization', `Bearer ${token}`);
    expect(draft.body.definition.trials[0].name).toBe('tab A');
  });

  it('rejects structurally invalid definitions with the offending path', async () => {
    const exp = await createExperiment(token);
    const res = await request(app)
      .put(`${API}/experiments/${exp.id}/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({ definition: { trials: [{ id: 't1', elements: [{ id: 'e1', type: 'NOT_A_TYPE' }] }] }, baseRevision: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('definition.trials[0].elements[0].type');
  });

  it('accepts incomplete drafts but reports them through validation', async () => {
    const exp = await createExperiment(token);
    const kb = element('KEYBOARD_PRESS');
    kb.scoring = { enabled: true, correctKey: null };
    expect((await saveDraft(token, exp.id, { ...createEmptyDefinition(), trials: [trial('T', 'response', [kb])] })).status).toBe(200);

    const v = await request(app).get(`${API}/experiments/${exp.id}/draft/validation`).set('Authorization', `Bearer ${token}`);
    expect(v.body.canPublish).toBe(false);
    expect(v.body.issues.map((i: { code: string }) => i.code)).toContain('keyboard_no_correct_key');
  });
});

describe('Publishing and versioning', () => {
  let token: string;
  beforeAll(async () => {
    token = (await createResearcher()).token;
  });

  const publish = (id: string) => request(app).post(`${API}/experiments/${id}/publish`).set('Authorization', `Bearer ${token}`);

  it('blocks publishing an empty experiment', async () => {
    const exp = await createExperiment(token);
    const res = await publish(exp.id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PUBLISH_VALIDATION_FAILED');
    expect(res.body.error.details.issues.map((i: { code: string }) => i.code)).toContain('no_trials');
    const after = await request(app).get(`${API}/experiments/${exp.id}`).set('Authorization', `Bearer ${token}`);
    expect(after.body.status).toBe('DRAFT');
  });

  it('blocks references to assets that do not belong to the experiment', async () => {
    const exp = await createExperiment(token);
    const img = element('IMAGE_VISUAL');
    img.config.assetId = '00000000-0000-4000-8000-000000000000';
    img.config.altText = 'x';
    await saveDraft(token, exp.id, { ...createEmptyDefinition(), trials: [trial('Img', 'manual', [img])] });
    const res = await publish(exp.id);
    expect(res.status).toBe(422);
    expect(res.body.error.details.issues.map((i: { code: string }) => i.code)).toContain('image_asset_not_found');
  });

  it('creates a new immutable version when the draft changes and reuses it otherwise', async () => {
    const { definition } = simpleDefinition();
    const { experimentId, versionId } = await publishedExperiment(token, definition);

    // Republishing identical content (the old code crashed here on a duplicate trial primary key).
    const same = await publish(experimentId);
    expect(same.status).toBe(200);
    expect(same.body.version).toMatchObject({ id: versionId, created: false });

    const edited = { ...definition, trials: definition.trials.map((t, i) => (i === 0 ? { ...t, name: 'Intro v2' } : t)) };
    expect((await saveDraft(token, experimentId, edited)).status).toBe(200);
    const info = await request(app).get(`${API}/experiments/${experimentId}`).set('Authorization', `Bearer ${token}`);
    expect(info.body.hasUnpublishedChanges).toBe(true);

    const second = await publish(experimentId);
    expect(second.status).toBe(200);
    expect(second.body.version).toMatchObject({ created: true, versionNumber: 2 });

    // Version 1 is untouched and both versions share stable trial keys.
    const v1 = await request(app).get(`${API}/experiments/${experimentId}/versions/${versionId}`).set('Authorization', `Bearer ${token}`);
    expect(v1.body.definition.trials[0].name).toBe('Intro');
    const rows = await prisma.experimentTrial.findMany({ where: { version: { experimentId } }, select: { id: true, trialKey: true } });
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((r) => r.trialKey)).size).toBe(3);
    expect(new Set(rows.map((r) => r.id)).size).toBe(6);
  });

  it('the draft survives publishing (previously the local draft was deleted)', async () => {
    const { definition } = simpleDefinition();
    const { experimentId } = await publishedExperiment(token, definition);
    const draft = await request(app).get(`${API}/experiments/${experimentId}/draft`).set('Authorization', `Bearer ${token}`);
    expect(draft.body.definition.trials).toHaveLength(3);
  });

  it('an experiment published before drafts existed opens its latest version as the draft', async () => {
    const researcher = await prisma.researcherProfile.findFirstOrThrow({ where: { user: { researcherProfile: { isNot: null } } } });
    const { definition } = simpleDefinition();
    const legacy = await prisma.experiment.create({
      data: {
        researcherId: researcher.id,
        title: 'Legacy',
        status: 'PUBLISHED',
        versions: {
          create: {
            versionNumber: 1,
            configHash: 'legacy',
            createdBy: 'test',
            publishedAt: new Date(),
            configSnapshot: { title: 'Legacy', trials: JSON.parse(JSON.stringify(definition.trials)) },
          },
        },
      },
    });
    // Access through the owning researcher's token is covered elsewhere; here we check the service directly.
    const { ExperimentService } = await import('../src/modules/experiments/experiments.service');
    const draft = await ExperimentService.getDraft(legacy.id, researcher.id);
    expect(draft.source).toBe('published_version');
    expect(draft.definition.trials).toHaveLength(3);
  });
});
