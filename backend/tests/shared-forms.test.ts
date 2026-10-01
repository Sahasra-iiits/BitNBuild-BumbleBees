import {
  checkTextValidation,
  coerceResponseValue,
  createElement,
  createEmptyDefinition,
  createTrial,
  duplicateElement,
  hasBlockingErrors,
  isDeferredResponseElement,
  jsLiteralToJson,
  orderedOptions,
  parseDefinition,
  parseQuestionFile,
  questionsToTrials,
  redactForParticipant,
  removeChoiceOption,
  removeGridColumn,
  removeGridRow,
  scoreElement,
  setChoiceSelection,
  validateDefinition,
  type ChoiceGridElement,
  type DateTimeElement,
  type ExperimentElement,
  type MultipleChoiceElement,
  type SliderRatingElement,
  type TextInputElement,
  type Trial,
} from '../src/shared/experiment';

const mc = () => createElement('MULTIPLE_CHOICE') as MultipleChoiceElement;
const codes = (...elements: ExperimentElement[]) => {
  const trial: Trial = { ...createTrial('T'), advanceMode: 'response', elements };
  return validateDefinition({ ...createEmptyDefinition(), trials: [trial] }).map((i) => i.code);
};

describe('multiple choice: single vs multiple selection', () => {
  it('multiple selection records the set in option order and enforces limits', () => {
    const el = mc();
    el.config.options.push({ id: 'o3', label: 'Option 3' });
    el.config.selection = 'multiple';
    el.config.minSelections = 2;
    el.config.maxSelections = 2;
    const [a, b] = el.config.options;
    expect(coerceResponseValue(el, [b.id, a.id])).toEqual({ ok: true, value: [a.id, b.id], display: 'Option 1; Option 2' });
    expect(coerceResponseValue(el, [a.id]).ok).toBe(false);
    expect(coerceResponseValue(el, [a.id, b.id, 'o3']).ok).toBe(false);
    expect(coerceResponseValue(el, [a.id, 'nope']).ok).toBe(false);
    expect(coerceResponseValue(el, a.id).ok).toBe(false);
    expect(coerceResponseValue(el, []).ok).toBe(false);
  });

  it('scores multiple selection only on the exact set', () => {
    const el = mc();
    el.config.options.push({ id: 'o3', label: 'C' });
    el.config.selection = 'multiple';
    const [a, b] = el.config.options;
    el.scoring = { enabled: true, correctOptionIds: [a.id, b.id] };
    expect(scoreElement(el, [b.id, a.id])).toBe(true);
    expect(scoreElement(el, [a.id])).toBe(false);
    expect(scoreElement(el, [a.id, b.id, 'o3'])).toBe(false);
  });

  it('checkboxes and dropdowns need Submit; single buttons are instant', () => {
    const el = mc();
    expect(isDeferredResponseElement(el)).toBe(false);
    expect(isDeferredResponseElement({ ...el, config: { ...el.config, display: 'dropdown' } })).toBe(true);
    expect(isDeferredResponseElement({ ...el, config: { ...el.config, selection: 'multiple' } })).toBe(true);
  });

  it('switching to single keeps one correct answer and drops dropdown/limits appropriately', () => {
    const el = mc();
    const [a, b] = el.config.options;
    const multi = setChoiceSelection({ ...el, config: { ...el.config, display: 'dropdown' } }, 'multiple');
    expect(multi.config.display).toBe('buttons');
    const withTwo = { ...multi, config: { ...multi.config, minSelections: 1 }, scoring: { enabled: true, correctOptionIds: [a.id, b.id] } };
    const single = setChoiceSelection(withTwo, 'single');
    expect(single.scoring.correctOptionIds).toEqual([a.id]);
    expect(single.config.minSelections).toBeNull();
  });

  it('validates selection limits and correct answers', () => {
    const el = mc();
    el.config.selection = 'multiple';
    el.config.minSelections = 3;
    expect(codes(el)).toContain('mc_min_above_options');
    el.config.minSelections = 2;
    el.config.maxSelections = 1;
    expect(codes(el)).toContain('mc_selection_range');
    const single = mc();
    single.scoring = { enabled: true, correctOptionIds: single.config.options.map((o) => o.id) };
    expect(codes(single)).toContain('mc_single_many_correct');
  });

  it('deleting a correct option removes only that answer', () => {
    const el = mc();
    const [a, b] = el.config.options;
    el.scoring = { enabled: true, correctOptionIds: [a.id, b.id] };
    expect(removeChoiceOption(el, a.id).scoring.correctOptionIds).toEqual([b.id]);
  });

  it('shuffles deterministically per seed', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `o${i}` }));
    const one = orderedOptions(items, true, 'session-a:el');
    expect(orderedOptions(items, true, 'session-a:el')).toEqual(one);
    expect([...one].sort((x, y) => x.id.localeCompare(y.id))).toEqual(items);
    expect(orderedOptions(items, false, 'x')).toEqual(items);
  });

  it('old definitions with a single correctOptionId still load', () => {
    const def = parseDefinition({
      trials: [
        {
          id: 't',
          advanceMode: 'response',
          elements: [{ id: 'm', type: 'MULTIPLE_CHOICE', config: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, scoring: { enabled: true, correctOptionId: 'b' } }],
        },
      ],
    });
    expect(def.trials[0].elements[0]).toMatchObject({ config: { selection: 'single', display: 'buttons', shuffleOptions: false }, scoring: { correctOptionIds: ['b'] } });
  });
});

describe('linear scale and star rating', () => {
  it('requires whole-number scales with at most 11 points', () => {
    const el = createElement('SLIDER_RATING') as SliderRatingElement;
    el.config = { ...el.config, display: 'scale', min: 1, max: 5, step: 1, defaultValue: 3 };
    expect(codes(el)).not.toContain('scale_points');
    el.config = { ...el.config, min: 0, max: 20 };
    expect(codes(el)).toContain('scale_points');
    el.config = { ...el.config, display: 'stars', min: 1, max: 5, step: 0.5 };
    expect(codes(el)).toContain('scale_points');
  });
});

describe('text answer validation', () => {
  const text = (validation: TextInputElement['config']['validation']) => {
    const el = createElement('TEXT_INPUT') as TextInputElement;
    el.config.validation = validation;
    return el;
  };

  it('checks numbers, emails, urls and patterns', () => {
    const num = text({ kind: 'number', min: 1, max: 10, integer: true });
    expect(coerceResponseValue(num, '5').ok).toBe(true);
    expect(coerceResponseValue(num, '5.5').ok).toBe(false);
    expect(coerceResponseValue(num, '11').ok).toBe(false);
    expect(coerceResponseValue(num, 'abc').ok).toBe(false);
    expect(coerceResponseValue(text({ kind: 'email' }), 'a@b.co').ok).toBe(true);
    expect(coerceResponseValue(text({ kind: 'email' }), 'not-an-email').ok).toBe(false);
    expect(coerceResponseValue(text({ kind: 'url' }), 'https://x.org').ok).toBe(true);
    expect(coerceResponseValue(text({ kind: 'url' }), 'javascript:alert(1)').ok).toBe(false);
    const re = text({ kind: 'regex', pattern: '[A-Z]{3}\\d{2}', message: 'Use a code like ABC12' });
    expect(coerceResponseValue(re, 'ABC12').ok).toBe(true);
    expect(coerceResponseValue(re, 'abc12')).toEqual({ ok: false, error: 'Use a code like ABC12' });
    // The server skips researcher-defined patterns (they could backtrack catastrophically).
    expect(coerceResponseValue(re, 'abc12', { skipPatternCheck: true }).ok).toBe(true);
  });

  it('reports invalid patterns and contradictory rules to the researcher', () => {
    expect(codes(text({ kind: 'regex', pattern: '([a-z', message: '' }))).toContain('text_regex_invalid');
    expect(codes(text({ kind: 'number', min: 5, max: 1, integer: false }))).toContain('text_number_range');
    const el = text({ kind: 'number', min: null, max: null, integer: false });
    el.scoring = { enabled: true, acceptedAnswers: ['Paris'], caseSensitive: false };
    expect(codes(el)).toContain('text_answer_fails_validation');
    expect(checkTextValidation(el, '12')).toBeNull();
  });
});

describe('date / time', () => {
  const dt = (mode: DateTimeElement['config']['mode']) => {
    const el = createElement('DATE_TIME') as DateTimeElement;
    el.config.mode = mode;
    return el;
  };
  it('accepts only real dates and times in the configured mode', () => {
    expect(coerceResponseValue(dt('date'), '2026-02-28').ok).toBe(true);
    expect(coerceResponseValue(dt('date'), '2026-02-30').ok).toBe(false);
    expect(coerceResponseValue(dt('time'), '23:59').ok).toBe(true);
    expect(coerceResponseValue(dt('time'), '24:00').ok).toBe(false);
    expect(coerceResponseValue(dt('datetime'), '2026-01-01T08:30')).toMatchObject({ ok: true, display: '2026-01-01 08:30' });
    expect(coerceResponseValue(dt('date'), '01/02/2026').ok).toBe(false);
  });
  it('scores exact values and validates the correct answer format', () => {
    const el = dt('date');
    el.scoring = { enabled: true, correctValue: '1969-07-20' };
    expect(scoreElement(el, '1969-07-20')).toBe(true);
    expect(scoreElement(el, '1969-07-21')).toBe(false);
    el.scoring.correctValue = '20/07/1969';
    expect(codes(el)).toContain('datetime_correct_format');
  });
});

describe('choice grid', () => {
  const grid = () => createElement('CHOICE_GRID') as ChoiceGridElement;

  it('requires every row when configured, one column per row for single selection', () => {
    const el = grid();
    const [r1, r2] = el.config.rows;
    const [c1, c2] = el.config.columns;
    expect(coerceResponseValue(el, { [r1.id]: [c1.id] })).toEqual({ ok: false, error: 'answer every row' });
    expect(coerceResponseValue(el, { [r1.id]: [c1.id], [r2.id]: [c2.id] })).toMatchObject({ ok: true, display: 'Row 1: Column 1; Row 2: Column 2' });
    expect(coerceResponseValue(el, { [r1.id]: [c1.id, c2.id], [r2.id]: [c2.id] }).ok).toBe(false);
    expect(coerceResponseValue(el, { nope: [c1.id] }).ok).toBe(false);
    const optional = { ...el, required: false };
    expect(coerceResponseValue(optional, { [r1.id]: [c1.id] }).ok).toBe(true);
    const checkbox = { ...el, config: { ...el.config, selection: 'multiple' as const } };
    expect(coerceResponseValue(checkbox, { [r1.id]: [c1.id, c2.id], [r2.id]: [c1.id] }).ok).toBe(true);
  });

  it('scores per row and only on rows that have a correct answer', () => {
    const el = grid();
    const [r1, r2] = el.config.rows;
    const [c1, c2] = el.config.columns;
    el.scoring = { enabled: true, correctColumns: { [r1.id]: [c2.id] } };
    expect(scoreElement(el, { [r1.id]: [c2.id], [r2.id]: [c1.id] })).toBe(true);
    expect(scoreElement(el, { [r1.id]: [c1.id], [r2.id]: [c1.id] })).toBe(false);
  });

  it('duplicates with fresh ids and remaps correct answers; deletion cleans answers', () => {
    const el = grid();
    const [r1] = el.config.rows;
    const [, c2] = el.config.columns;
    el.scoring = { enabled: true, correctColumns: { [r1.id]: [c2.id] } };
    const copy = duplicateElement(el) as ChoiceGridElement;
    expect(copy.config.rows[0].id).not.toBe(r1.id);
    expect(copy.scoring.correctColumns).toEqual({ [copy.config.rows[0].id]: [copy.config.columns[1].id] });
    expect(removeGridColumn(el, c2.id).scoring.correctColumns[r1.id]).toEqual([]);
    expect(removeGridRow(el, r1.id).scoring.correctColumns).toEqual({});
    expect(codes(removeGridColumn(el, c2.id))).toEqual(expect.arrayContaining(['grid_few_columns', 'grid_no_correct']));
  });

  it('redaction removes grid and multi-select answers', () => {
    const g = grid();
    g.scoring = { enabled: true, correctColumns: { [g.config.rows[0].id]: [g.config.columns[0].id] } };
    const m = mc();
    m.scoring = { enabled: true, correctOptionIds: [m.config.options[0].id] };
    const def = redactForParticipant({ ...createEmptyDefinition(), trials: [{ ...createTrial('t'), elements: [g, m] }] });
    const [rg, rm] = def.trials[0].elements as [ChoiceGridElement, MultipleChoiceElement];
    expect(rg.scoring.correctColumns).toEqual({});
    expect(rm.scoring.correctOptionIds).toEqual([]);
  });
});

describe('question import', () => {
  it('imports JSON with labels, letters, indexes and option objects', () => {
    const json = JSON.stringify({
      questions: [
        { question: 'Capital of France?', options: ['Paris', 'Rome', 'Oslo'], answer: 'Paris' },
        { question: 'Pick primes', options: ['2', '3', '4'], answer: [0, 1], type: 'multiple' },
        { question: 'Letter answer', options: ['x', 'y'], answer: 'B', shuffle: true },
        { question: 'Objects', options: [{ label: 'right', correct: true }, { label: 'wrong' }], type: 'dropdown' },
        { question: 'Survey (unscored)', options: ['Agree', 'Disagree'], required: false },
      ],
    });
    const r = parseQuestionFile('quiz.json', json);
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => [q.correct, q.selection, q.display])).toEqual([
      [[0], 'single', 'buttons'],
      [[0, 1], 'multiple', 'buttons'],
      [[1], 'single', 'buttons'],
      [[0], 'single', 'dropdown'],
      [[], 'single', 'buttons'],
    ]);
    expect(r.questions[2].shuffle).toBe(true);
    expect(r.questions[4].required).toBe(false);
  });

  it('reads JavaScript data files without executing them', () => {
    const js = `// quiz data
export default [
  { question: 'It\\'s 2 + 2?', options: ['3', '4',], answer: 1, },
  /* block comment */
  { question: "Say \\"hi\\"", options: ['hi', 'bye'], answer: 'hi' },
];`;
    const r = parseQuestionFile('quiz.js', js);
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({ prompt: "It's 2 + 2?", correct: [1] });
    expect(r.questions[1].prompt).toBe('Say "hi"');
    expect(parseQuestionFile('evil.js', 'export default [{ question: require("fs"), options: [] }]').errors[0].message).toMatch(/not valid/);
    expect(parseQuestionFile('evil.js', 'export default [`${process.exit()}`]').errors[0].message).toMatch(/not valid/);
    expect(jsLiteralToJson("module.exports = { a: 'b' };")).toBe('{ "a": "b" }');
  });

  it('imports CSV with option columns, a single options column, quotes and semicolons', () => {
    const csv = 'question,option1,option2,option3,answer,type\r\n"What is ""2 + 2""?",3,4,5,2,\r\nPick evens,1,2,4,2|3,multiple\r\n';
    const r = parseQuestionFile('quiz.csv', csv);
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({ prompt: 'What is "2 + 2"?', options: ['3', '4', '5'], correct: [1] });
    expect(r.questions[1]).toMatchObject({ correct: [1, 2], selection: 'multiple' });

    const semi = 'Question;Options;Answer\nColour of sky?;Blue|Green;A\n';
    expect(parseQuestionFile('q.csv', semi).questions[0]).toMatchObject({ options: ['Blue', 'Green'], correct: [0] });
  });

  it('refuses to guess when a numeric answer is both an option label and another option’s position', () => {
    const csv = 'question,option1,option2,option3,option4,answer,type\nPrimes,2,3,4,9,1|2,multiple\nPrimes by letter,2,3,4,9,A|B,multiple\n';
    const r = parseQuestionFile('q.csv', csv);
    expect(r.errors).toEqual([{ at: 2, message: expect.stringMatching(/ambiguous/) }]);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({ prompt: 'Primes by letter', correct: [0, 1] });
    // JSON numbers are typed, so quoted numbers are option text.
    const json = parseQuestionFile('q.json', JSON.stringify([{ question: 'Primes', options: ['2', '3', '4', '9'], answer: ['2', '3'], type: 'multiple' }]));
    expect(json.errors).toEqual([]);
    expect(json.questions[0].correct).toEqual([0, 1]);
    // Unambiguous: "9" is a label, not a valid position among 4 options.
    expect(parseQuestionFile('q.csv', 'question,a,b,c,d,answer\nQ,2,3,4,9,9\n').questions[0].correct).toEqual([3]);
  });

  it('reports bad CSV rows with their line numbers and keeps the good ones', () => {
    const csv = 'question,A,B,answer\nGood,yes,no,A\nOne option,only,,A\nBad answer,x,y,Z\n';
    const r = parseQuestionFile('q.csv', csv);
    expect(r.questions).toHaveLength(1);
    expect(r.errors.map((e) => e.at)).toEqual([3, 4]);
  });

  it('imports Aiken text, including multi-answer extensions', () => {
    const aiken = `What is 2 + 2?
A. 3
B. 4
ANSWER: B

Which are colours?
A) Red
B) Table
C) Blue
ANSWER: A, C

Missing answer
A. x
B. y
`;
    const r = parseQuestionFile('quiz.txt', aiken);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({ prompt: 'What is 2 + 2?', correct: [1], selection: 'single' });
    expect(r.questions[1]).toMatchObject({ correct: [0, 2], selection: 'multiple' });
    expect(r.errors).toEqual([{ at: 3, message: 'missing "ANSWER:" line' }]);
  });

  it('turns imported questions into valid, publishable trials', () => {
    const r = parseQuestionFile('q.json', JSON.stringify([
      { question: 'Q1', options: ['a', 'b'], answer: 'a' },
      { question: 'Q2', options: ['a', 'b', 'c'], answer: ['a', 'c'], type: 'multiple' },
      { question: 'Q3', options: ['a', 'b'] },
    ]));
    const trials = questionsToTrials(r.questions, { advanceMode: 'response', condition: 'quiz', namePrefix: 'Question' });
    const def = { ...createEmptyDefinition(), trials };
    expect(hasBlockingErrors(validateDefinition(def))).toBe(false);
    const [t1, t2, t3] = trials.map((t) => t.elements[0] as MultipleChoiceElement);
    expect(t1.scoring.correctOptionIds).toEqual([t1.config.options[0].id]);
    expect(t2.scoring.correctOptionIds).toEqual([t2.config.options[0].id, t2.config.options[2].id]);
    expect(t3.scoring.enabled).toBe(false);
    expect(trials[0]).toMatchObject({ name: 'Question 1', condition: 'quiz', advanceMode: 'response' });
    expect(new Set(trials.flatMap((t) => (t.elements[0] as MultipleChoiceElement).config.options.map((o) => o.id))).size).toBe(7);
    // Round-trips through the server parser unchanged.
    expect(parseDefinition(JSON.parse(JSON.stringify(def)))).toEqual(def);
  });

  it('rejects empty files and files that are too large', () => {
    expect(parseQuestionFile('q.json', '[]').errors[0].message).toMatch(/No questions/);
    expect(parseQuestionFile('q.csv', 'x'.repeat(3 * 1024 * 1024)).errors[0].message).toMatch(/2 MB/);
  });
});
