import { prisma } from '../src/config/database';
import { complete, createParticipant, createResearcher, element, event, ingest, publishedExperiment, startSession, trial } from './helpers';
import { createEmptyDefinition, type ChoiceGridElement, type DateTimeElement, type MultipleChoiceElement } from '../src/shared/experiment';

describe('Google-Forms-style responses end to end', () => {
  it('ingests, scores and stores checkbox, dropdown, grid and date answers', async () => {
    const researcher = await createResearcher();
    const boxes = element('MULTIPLE_CHOICE') as MultipleChoiceElement;
    boxes.config.options.push({ id: 'c-opt', label: 'Option 3' });
    boxes.config.selection = 'multiple';
    boxes.scoring = { enabled: true, correctOptionIds: [boxes.config.options[0].id, 'c-opt'] };
    const dropdown = element('MULTIPLE_CHOICE') as MultipleChoiceElement;
    dropdown.config.display = 'dropdown';
    dropdown.scoring = { enabled: true, correctOptionIds: [dropdown.config.options[1].id] };
    const grid = element('CHOICE_GRID') as ChoiceGridElement;
    grid.scoring = { enabled: true, correctColumns: { [grid.config.rows[0].id]: [grid.config.columns[0].id] } };
    const date = element('DATE_TIME') as DateTimeElement;

    const trials = [trial('Boxes', 'response', [boxes]), trial('Dropdown', 'response', [dropdown]), trial('Grid', 'response', [grid]), trial('Date', 'response', [date])];
    const { experimentId } = await publishedExperiment(researcher.token, { ...createEmptyDefinition(), trials });
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const sessionId = s.body.session.id;

    // Checkbox, dropdown, grid and date questions use Submit, so advanceReason must be "submit".
    const bad = await ingest(p.token, sessionId, [event({ trialId: trials[0].id, trialSequence: 0, advanceReason: 'response', elements: [{ elementId: boxes.id, value: [boxes.config.options[0].id] }] })]);
    expect(bad.status).toBe(400);

    const res = await ingest(p.token, sessionId, [
      event({ trialId: trials[0].id, trialSequence: 0, advanceReason: 'submit', elements: [{ elementId: boxes.id, value: ['c-opt', boxes.config.options[0].id] }] }),
      event({ trialId: trials[1].id, trialSequence: 1, advanceReason: 'submit', elements: [{ elementId: dropdown.id, value: dropdown.config.options[0].id }] }),
      event({
        trialId: trials[2].id,
        trialSequence: 2,
        advanceReason: 'submit',
        elements: [{ elementId: grid.id, value: { [grid.config.rows[0].id]: [grid.config.columns[0].id], [grid.config.rows[1].id]: [grid.config.columns[1].id] } }],
      }),
      event({ trialId: trials[3].id, trialSequence: 3, advanceReason: 'submit', elements: [{ elementId: date.id, value: '2026-10-01' }] }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.ingested).toBe(4);

    const rows = await prisma.trialResponse.findMany({ where: { sessionId }, orderBy: { trialSequence: 'asc' } });
    expect(rows.map((r) => r.correct)).toEqual([true, false, true, null]);
    const first = rows[0].response as { elements: Array<{ value: unknown; display: string }> };
    expect(first.elements[0]).toMatchObject({ value: [boxes.config.options[0].id, 'c-opt'], display: 'Option 1; Option 3' });
    expect((await complete(p.token, sessionId)).status).toBe(200);
  });

  it('rejects a grid answer that skips a required row', async () => {
    const researcher = await createResearcher();
    const grid = element('CHOICE_GRID') as ChoiceGridElement;
    const t = trial('Grid', 'response', [grid]);
    const { experimentId } = await publishedExperiment(researcher.token, { ...createEmptyDefinition(), trials: [t] });
    const p = await createParticipant();
    const s = await startSession(p.token, experimentId);
    const res = await ingest(p.token, s.body.session.id, [
      event({ trialId: t.id, trialSequence: 0, advanceReason: 'submit', elements: [{ elementId: grid.id, value: { [grid.config.rows[0].id]: [grid.config.columns[0].id] } }] }),
    ]);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/every row/);
  });
});
