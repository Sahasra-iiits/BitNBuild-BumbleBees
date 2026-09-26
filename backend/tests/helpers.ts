import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { createElement, createEmptyDefinition, createTrial, type ExperimentDefinition, type ExperimentElement, type Trial } from '../src/shared/experiment';

export const API = '/api/v1';

export const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function createResearcher() {
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ email: `researcher-${unique()}@test.com`, password: 'ValidPass123', role: 'RESEARCHER', researcherProfile: { institution: 'Test Lab' } });
  if (res.status !== 201) throw new Error(`register researcher failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, user: res.body.user };
}

export async function createParticipant(age = 25) {
  const res = await request(app)
    .post(`${API}/auth/register`)
    .send({ email: `participant-${unique()}@test.com`, password: 'ValidPass123', role: 'PARTICIPANT', participantProfile: { age } });
  if (res.status !== 201) throw new Error(`register participant failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken as string, user: res.body.user, profileId: res.body.user.participantProfile.id as string };
}

export function element<T extends ExperimentElement['type']>(type: T): Extract<ExperimentElement, { type: T }> {
  return createElement(type) as Extract<ExperimentElement, { type: T }>;
}

export function trial(name: string, mode: Trial['advanceMode'], elements: ExperimentElement[], extra: Partial<Trial> = {}): Trial {
  return { ...createTrial(name), advanceMode: mode, elements, ...extra };
}

/** Instruction -> keyboard (A/L, correct A) -> yes/no (correct yes). */
export function simpleDefinition(): { definition: ExperimentDefinition; ids: { intro: string; kbTrial: string; kb: string; ynTrial: string; yn: string } } {
  const text = element('TEXT_INSTRUCTION');
  text.config.text = 'Welcome';
  const kb = element('KEYBOARD_PRESS');
  kb.config.allowedKeys = ['a', 'l'];
  kb.scoring = { enabled: true, correctKey: 'a' };
  const yn = element('YES_NO');
  yn.scoring = { enabled: true, correctValue: true };
  const intro = trial('Intro', 'manual', [text]);
  const kbTrial = trial('Keyboard', 'response', [kb], { condition: 'A' });
  const ynTrial = trial('YesNo', 'response', [yn], { condition: 'B' });
  return {
    definition: { ...createEmptyDefinition(), trials: [intro, kbTrial, ynTrial] },
    ids: { intro: intro.id, kbTrial: kbTrial.id, kb: kb.id, ynTrial: ynTrial.id, yn: yn.id },
  };
}

export async function createExperiment(token: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`${API}/experiments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: `Experiment ${unique()}`, visibility: 'PUBLIC', ...body });
  if (res.status !== 201) throw new Error(`create experiment failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string };
}

export async function saveDraft(token: string, experimentId: string, definition: ExperimentDefinition) {
  const current = await request(app).get(`${API}/experiments/${experimentId}/draft`).set('Authorization', `Bearer ${token}`);
  return request(app)
    .put(`${API}/experiments/${experimentId}/draft`)
    .set('Authorization', `Bearer ${token}`)
    .send({ definition, baseRevision: current.body.revision });
}

export async function publishedExperiment(token: string, definition: ExperimentDefinition, body: Record<string, unknown> = {}) {
  const exp = await createExperiment(token, body);
  const saved = await saveDraft(token, exp.id, definition);
  if (saved.status !== 200) throw new Error(`save draft failed: ${saved.status} ${JSON.stringify(saved.body)}`);
  const pub = await request(app).post(`${API}/experiments/${exp.id}/publish`).set('Authorization', `Bearer ${token}`);
  if (pub.status !== 200) throw new Error(`publish failed: ${pub.status} ${JSON.stringify(pub.body)}`);
  return { experimentId: exp.id, versionId: pub.body.version.id as string };
}

export async function startSession(token: string, experimentId: string, idempotencyKey = `key-${unique()}`) {
  return request(app).post(`${API}/experiments/${experimentId}/sessions`).set('Authorization', `Bearer ${token}`).send({ idempotencyKey });
}

export interface EventInput {
  trialId: string;
  trialSequence: number;
  advanceReason: 'response' | 'submit' | 'continue' | 'timeout';
  elements?: Array<{ elementId: string; value: unknown; rtMs?: number }>;
  reactionTimeMs?: number | null;
}

export function event(input: EventInput) {
  return {
    eventId: randomUUID(),
    trialId: input.trialId,
    trialSequence: input.trialSequence,
    stimulusDisplayTimestamp: Date.now() - 1000,
    responseTimestamp: Date.now(),
    reactionTimeMs: input.reactionTimeMs === undefined ? 500 : input.reactionTimeMs,
    response: {
      advanceReason: input.advanceReason,
      elements: (input.elements ?? []).map((e) => ({ elementId: e.elementId, value: e.value, rtMs: e.rtMs ?? 500 })),
    },
  };
}

export async function ingest(token: string, sessionId: string, events: unknown[]) {
  return request(app).post(`${API}/sessions/${sessionId}/events/batch`).set('Authorization', `Bearer ${token}`).send({ events });
}

export async function complete(token: string, sessionId: string) {
  return request(app).post(`${API}/sessions/${sessionId}/complete`).set('Authorization', `Bearer ${token}`);
}
