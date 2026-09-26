import {
  addElement,
  addTrial,
  deleteElement,
  deleteTrial,
  duplicateElementIn,
  duplicateTrialIn,
  moveElement,
  moveTrial,
  removeAllowedKey,
  removeChoiceOption,
  updateElement,
  updateTrial,
  coerceResponseValue,
  computeTrialOrder,
  createElement,
  createEmptyDefinition,
  createTrial,
  definitionFromSnapshot,
  DefinitionParseError,
  duplicateElement,
  duplicateTrial,
  hasBlockingErrors,
  matchResponseKey,
  normalizeKey,
  parseDefinition,
  redactForParticipant,
  requiredResponsesSatisfied,
  scoreElement,
  scoreTrial,
  shouldAdvanceAfterInstantResponse,
  stableStringify,
  trialUsesSubmit,
  validateDefinition,
  type ExperimentDefinition,
  type ExperimentElement,
  type ResponseValue,
  type Trial,
} from '../src/shared/experiment';

function el<T extends ExperimentElement['type']>(type: T): Extract<ExperimentElement, { type: T }> {
  return createElement(type) as Extract<ExperimentElement, { type: T }>;
}

function defWith(...trials: Trial[]): ExperimentDefinition {
  return { ...createEmptyDefinition(), trials };
}

function trialWith(mode: Trial['advanceMode'], ...elements: ExperimentElement[]): Trial {
  return { ...createTrial('T'), advanceMode: mode, elements };
}

function codes(def: ExperimentDefinition) {
  return validateDefinition(def).map((i) => `${i.severity}:${i.code}`);
}

describe('keys', () => {
  it('normalizes keys consistently for builder and runtime', () => {
    expect(normalizeKey(' ')).toBe('space');
    expect(normalizeKey('A')).toBe('a');
    expect(normalizeKey('ArrowLeft')).toBe('arrowleft');
  });

  const press = (key: string, extra: Partial<{ repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
    key,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...extra,
  });

  it('matches allowed keys case-insensitively (the old runtime upper-cased and never matched)', () => {
    expect(matchResponseKey(press('A'), ['a', 'l'])).toBe('a');
    expect(matchResponseKey(press('a'), ['a', 'l'])).toBe('a');
    expect(matchResponseKey(press('x'), ['a', 'l'])).toBeNull();
  });

  it('ignores held-key repeats and shortcut chords', () => {
    expect(matchResponseKey(press('a', { repeat: true }), ['a'])).toBeNull();
    expect(matchResponseKey(press('r', { ctrlKey: true }), [])).toBeNull();
    expect(matchResponseKey(press('c', { metaKey: true }), ['c'])).toBeNull();
  });

  it('any-key mode ignores modifiers, Tab and Escape', () => {
    expect(matchResponseKey(press('Shift'), [])).toBeNull();
    expect(matchResponseKey(press('Escape'), [])).toBeNull();
    expect(matchResponseKey(press('Tab'), [])).toBeNull();
    expect(matchResponseKey(press(' '), [])).toBe('space');
  });
});

describe('parseDefinition / migration', () => {
  it('migrates the legacy builder format', () => {
    const legacy = {
      id: 'exp',
      trials: [
        {
          id: 't1',
          name: 'Legacy',
          advanceMode: 'response',
          durationMs: null,
          elements: [
            { id: 'k', type: 'KEYBOARD_PRESS', role: 'RESPONSE', config: { allowedKeys: ['a', 'l'] }, scoring: { enabled: true, type: 'exact', correctAnswer: 'a' } },
            { id: 'm', type: 'MULTIPLE_CHOICE', role: 'RESPONSE', config: { options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }] }, scoring: { enabled: true, type: 'exact', correctAnswer: 'o2' } },
            { id: 'i', type: 'IMAGE_VISUAL', role: 'DISPLAY', config: { url: 'asset://abc', altText: '' } },
            { id: 'c', type: 'MOUSE_CLICK', role: 'RESPONSE', config: {}, scoring: { enabled: false, type: 'none' } },
          ],
        },
      ],
    };
    const def = parseDefinition(legacy);
    const [k, m, img, click] = def.trials[0].elements;
    expect(def.schemaVersion).toBe(2);
    expect(k).toMatchObject({ type: 'KEYBOARD_PRESS', required: true, scoring: { enabled: true, correctKey: 'a' } });
    expect(m).toMatchObject({ scoring: { enabled: true, correctOptionId: 'o2' } });
    expect(img).toMatchObject({ config: { assetId: null, url: 'asset://abc' } });
    expect(click).toMatchObject({ type: 'MOUSE_CLICK', config: { prompt: 'Click anywhere to respond' } });
    // The browser-local reference must be flagged, never silently accepted.
    expect(codes(def)).toContain('error:image_local_reference');
  });

  it('reads definitions from both snapshot formats', () => {
    const t = { id: 't', name: 'x', advanceMode: 'manual', elements: [] };
    expect(definitionFromSnapshot({ title: 'old', trials: [t] }).trials[0].id).toBe('t');
    expect(definitionFromSnapshot({ definition: { schemaVersion: 2, trials: [t] } }).trials[0].id).toBe('t');
  });

  it('rejects structurally invalid input with a path', () => {
    expect(() => parseDefinition({ trials: [{ id: 't', elements: [{ id: 'e', type: 'BOGUS' }] }] })).toThrow(DefinitionParseError);
    expect(() => parseDefinition({ trials: [{ id: 't', advanceMode: 'sometimes' }] })).toThrow(/advanceMode/);
    expect(() => parseDefinition({ trials: [{ id: '', elements: [] }] })).toThrow(/id/);
    expect(() => parseDefinition({ trials: 'nope' })).toThrow(/array/);
    expect(() => parseDefinition({ schemaVersion: 99, trials: [] })).toThrow(/schema version/);
  });

  it('round-trips a canonical definition unchanged', () => {
    const def = defWith(
      trialWith('response', el('KEYBOARD_PRESS')),
      trialWith('manual', el('SLIDER_RATING'), el('TEXT_INPUT'), el('YES_NO'), el('MULTIPLE_CHOICE'))
    );
    expect(stableStringify(parseDefinition(JSON.parse(JSON.stringify(def))))).toBe(stableStringify(def));
  });
});

describe('validateDefinition', () => {
  it('blocks an empty experiment and empty trials', () => {
    expect(codes(defWith())).toContain('error:no_trials');
    expect(codes(defWith(trialWith('manual')))).toContain('error:trial_empty');
  });

  it('does not require scoring on display-only elements', () => {
    const text = el('TEXT_INSTRUCTION');
    text.config.text = 'Welcome';
    const fix = el('FIXATION_CROSS');
    const issues = validateDefinition(defWith(trialWith('manual', text), { ...trialWith('timed', fix), durationMs: 500 }));
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it('flags a response-mode trial without response elements (would wait forever)', () => {
    const text = el('TEXT_INSTRUCTION');
    text.config.text = 'hi';
    expect(codes(defWith(trialWith('response', text)))).toContain('error:trial_waits_for_missing_response');
  });

  it('requires a duration for timed trials', () => {
    const fix = el('FIXATION_CROSS');
    expect(codes(defWith(trialWith('timed', fix)))).toContain('error:trial_duration');
    expect(codes(defWith({ ...trialWith('timed', fix), durationMs: 10 }))).toContain('error:trial_duration');
    expect(codes(defWith({ ...trialWith('timed', fix), durationMs: 500 }))).not.toContain('error:trial_duration');
  });

  it('validates keyboard scoring against allowed keys', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.config.allowedKeys = ['a', 'l'];
    kb.scoring = { enabled: true, correctKey: null };
    expect(codes(defWith(trialWith('response', kb)))).toContain('error:keyboard_no_correct_key');
    kb.scoring.correctKey = 'x';
    expect(codes(defWith(trialWith('response', kb)))).toContain('error:keyboard_correct_key_not_allowed');
    kb.scoring.correctKey = 'a';
    expect(hasBlockingErrors(validateDefinition(defWith(trialWith('response', kb))))).toBe(false);
    kb.scoring.enabled = false;
    kb.scoring.correctKey = null;
    expect(hasBlockingErrors(validateDefinition(defWith(trialWith('response', kb))))).toBe(false);
  });

  it('detects a deleted correct option instead of choosing a replacement', () => {
    const mc = el('MULTIPLE_CHOICE');
    mc.scoring = { enabled: true, correctOptionId: 'deleted-option' };
    expect(codes(defWith(trialWith('response', mc)))).toContain('error:mc_correct_option_missing');
  });

  it('validates slider ranges, steps, defaults and correct ranges', () => {
    const s = el('SLIDER_RATING');
    s.config = { ...s.config, min: 10, max: 5 };
    expect(codes(defWith(trialWith('response', s)))).toContain('error:slider_min_max');
    s.config = { ...s.config, min: 1, max: 100, step: 0 };
    expect(codes(defWith(trialWith('response', s)))).toContain('error:slider_step');
    s.config = { ...s.config, step: 1, defaultValue: 500 };
    expect(codes(defWith(trialWith('response', s)))).toContain('error:slider_default_range');
    s.config = { ...s.config, defaultValue: 50 };
    s.scoring = { enabled: true, correctMin: 90, correctMax: 120 };
    expect(codes(defWith(trialWith('response', s)))).toContain('error:slider_correct_range_bounds');
    s.scoring = { enabled: true, correctMin: 60, correctMax: 40 };
    expect(codes(defWith(trialWith('response', s)))).toContain('error:slider_correct_range_order');
    s.config = { ...s.config, min: -10, max: 10, step: 0.5, defaultValue: -2.5 };
    s.scoring = { enabled: true, correctMin: -1, correctMax: 1 };
    expect(hasBlockingErrors(validateDefinition(defWith(trialWith('response', s))))).toBe(false);
  });

  it('validates text input lengths and accepted answers', () => {
    const t = el('TEXT_INPUT');
    t.config.minLength = 5;
    t.config.maxLength = 2;
    expect(codes(defWith(trialWith('response', t)))).toContain('error:text_length_order');
    t.config.maxLength = null;
    t.scoring = { enabled: true, acceptedAnswers: ['  '], caseSensitive: false };
    expect(codes(defWith(trialWith('response', t)))).toContain('error:text_no_answers');
  });

  it('flags ambiguous response combinations', () => {
    const a = el('KEYBOARD_PRESS');
    a.config.allowedKeys = ['a'];
    const b = el('KEYBOARD_PRESS');
    b.config.allowedKeys = ['a', 'b'];
    expect(codes(defWith(trialWith('response', a, b)))).toContain('error:trial_keyboard_overlap');
    expect(codes(defWith(trialWith('response', el('MOUSE_CLICK'), el('MULTIPLE_CHOICE'))))).toContain('error:trial_mouse_conflict');
  });

  it('checks uploaded assets against the experiment asset list when provided', () => {
    const img = el('IMAGE_VISUAL');
    img.config.assetId = 'a1';
    img.config.altText = 'x';
    const def = defWith(trialWith('manual', img));
    expect(validateDefinition(def, { knownAssetIds: new Set(['a1']) }).some((i) => i.severity === 'error')).toBe(false);
    expect(validateDefinition(def, { knownAssetIds: new Set() }).map((i) => i.code)).toContain('image_asset_not_found');
  });
});

describe('scoring', () => {
  it('scores each response type with its own rule', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.config.allowedKeys = ['a', 'l'];
    kb.scoring = { enabled: true, correctKey: 'a' };
    expect(scoreElement(kb, 'a')).toBe(true);
    expect(scoreElement(kb, 'l')).toBe(false);

    const mc = el('MULTIPLE_CHOICE');
    mc.scoring = { enabled: true, correctOptionId: mc.config.options[1].id };
    expect(scoreElement(mc, mc.config.options[1].id)).toBe(true);
    expect(scoreElement(mc, mc.config.options[0].id)).toBe(false);

    const s = el('SLIDER_RATING');
    s.scoring = { enabled: true, correctMin: 3, correctMax: 5 };
    expect(scoreElement(s, 3)).toBe(true);
    expect(scoreElement(s, 5)).toBe(true);
    expect(scoreElement(s, 6)).toBe(false);
    // Legacy runtime compared the string "4" to a number; values are numbers now.
    expect(scoreElement(s, '4')).toBe(false);

    const t = el('TEXT_INPUT');
    t.scoring = { enabled: true, acceptedAnswers: ['Paris'], caseSensitive: false };
    expect(scoreElement(t, '  paris ')).toBe(true);
    expect(scoreElement(t, 'london')).toBe(false);
    t.scoring.caseSensitive = true;
    expect(scoreElement(t, 'paris')).toBe(false);

    const yn = el('YES_NO');
    yn.scoring = { enabled: true, correctValue: false };
    expect(scoreElement(yn, false)).toBe(true);
    expect(scoreElement(yn, true)).toBe(false);
  });

  it('never scores display elements or unscored responses', () => {
    expect(scoreElement(el('IMAGE_VISUAL'), undefined)).toBeNull();
    expect(scoreElement(el('MOUSE_CLICK'), { x: 0.5, y: 0.5 })).toBeNull();
    expect(scoreElement(el('KEYBOARD_PRESS'), 'a')).toBeNull();
  });

  it('counts a missed scored response as incorrect and aggregates per trial', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.scoring = { enabled: true, correctKey: 'a' };
    const yn = el('YES_NO');
    yn.scoring = { enabled: true, correctValue: true };
    const trial = trialWith('response', kb, yn);
    expect(scoreTrial(trial, new Map<string, ResponseValue>([[kb.id, 'a'], [yn.id, true]])).correct).toBe(true);
    expect(scoreTrial(trial, new Map<string, ResponseValue>([[kb.id, 'a']])).correct).toBe(false);
    expect(scoreTrial(trialWith('manual', el('FIXATION_CROSS')), new Map()).correct).toBeNull();
  });
});

describe('response coercion', () => {
  it('rejects values the element cannot produce', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.config.allowedKeys = ['a'];
    expect(coerceResponseValue(kb, 'b').ok).toBe(false);
    expect(coerceResponseValue(kb, 'a')).toEqual({ ok: true, value: 'a', display: 'A' });

    const mc = el('MULTIPLE_CHOICE');
    expect(coerceResponseValue(mc, 'nope').ok).toBe(false);
    expect(coerceResponseValue(mc, mc.config.options[0].id)).toMatchObject({ ok: true, display: 'Option 1' });

    const s = el('SLIDER_RATING');
    s.config = { ...s.config, min: -1, max: 1, step: 0.1, defaultValue: 0 };
    expect(coerceResponseValue(s, 0.30000000000000004)).toMatchObject({ ok: true, value: 0.3 });
    expect(coerceResponseValue(s, 2).ok).toBe(false);
    expect(coerceResponseValue(s, '0.5').ok).toBe(false);

    const t = el('TEXT_INPUT');
    t.config.minLength = 3;
    t.config.maxLength = 5;
    expect(coerceResponseValue(t, '  ').ok).toBe(false);
    expect(coerceResponseValue(t, 'ab').ok).toBe(false);
    expect(coerceResponseValue(t, 'abcdef').ok).toBe(false);
    expect(coerceResponseValue(t, ' abcd ')).toMatchObject({ ok: true, value: 'abcd' });

    expect(coerceResponseValue(el('YES_NO'), 'yes').ok).toBe(false);
    expect(coerceResponseValue(el('MOUSE_CLICK'), { x: 2, y: 0 }).ok).toBe(false);
    expect(coerceResponseValue(el('IMAGE_VISUAL'), 'x').ok).toBe(false);
  });
});

describe('advancement rules', () => {
  it('does not auto-advance on a single answer when other required answers are pending', () => {
    const kb = el('KEYBOARD_PRESS');
    const yn = el('YES_NO');
    const trial = trialWith('response', kb, yn);
    expect(shouldAdvanceAfterInstantResponse(trial, new Set([kb.id]))).toBe(false);
    expect(shouldAdvanceAfterInstantResponse(trial, new Set([kb.id, yn.id]))).toBe(true);
  });

  it('uses Submit for slider and text trials, never auto-advancing', () => {
    const trial = trialWith('response', el('SLIDER_RATING'), el('YES_NO'));
    expect(trialUsesSubmit(trial)).toBe(true);
    expect(shouldAdvanceAfterInstantResponse(trial, new Set(trial.elements.map((e) => e.id)))).toBe(false);
  });

  it('manual and timed trials never auto-advance on responses', () => {
    const kb = el('KEYBOARD_PRESS');
    expect(shouldAdvanceAfterInstantResponse(trialWith('manual', kb), new Set([kb.id]))).toBe(false);
    expect(shouldAdvanceAfterInstantResponse({ ...trialWith('timed', kb), durationMs: 500 }, new Set([kb.id]))).toBe(false);
  });

  it('optional-only trials end on the first response', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.required = false;
    const trial = trialWith('response', kb);
    expect(requiredResponsesSatisfied(trial, new Set())).toBe(true);
    expect(shouldAdvanceAfterInstantResponse(trial, new Set())).toBe(false);
    expect(shouldAdvanceAfterInstantResponse(trial, new Set([kb.id]))).toBe(true);
  });
});

describe('duplication', () => {
  it('gives the copy new ids and no shared mutable state', () => {
    const mc = el('MULTIPLE_CHOICE');
    mc.scoring = { enabled: true, correctOptionId: mc.config.options[1].id };
    const original = trialWith('response', mc);
    const copy = duplicateTrial(original);
    const copiedMc = copy.elements[0] as typeof mc;

    expect(copy.id).not.toBe(original.id);
    expect(copiedMc.id).not.toBe(mc.id);
    expect(copiedMc.config.options.map((o) => o.id)).not.toEqual(mc.config.options.map((o) => o.id));
    // The correct answer follows the copied option rather than pointing at the original.
    expect(copiedMc.scoring.correctOptionId).toBe(copiedMc.config.options[1].id);

    copiedMc.config.options[0].label = 'changed';
    expect(mc.config.options[0].label).toBe('Option 1');
    expect(duplicateElement(mc).id).not.toBe(mc.id);
  });
});

describe('trial order', () => {
  it('is identity when randomization is off', () => {
    const def = defWith(createTrial('a'), createTrial('b'), createTrial('c'));
    expect(computeTrialOrder(def, 'seed')).toEqual([0, 1, 2]);
  });

  it('is deterministic per seed and keeps fixed trials in place', () => {
    const trials = Array.from({ length: 8 }, (_, i) => ({ ...createTrial(`t${i}`), fixedPosition: i === 0 || i === 7 }));
    const def = { ...defWith(...trials), settings: { randomizeTrialOrder: true } };
    const a = computeTrialOrder(def, 'session-1');
    expect(computeTrialOrder(def, 'session-1')).toEqual(a);
    expect(a[0]).toBe(0);
    expect(a[7]).toBe(7);
    expect([...a].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('edit operations', () => {
  it('never mutates the input definition', () => {
    const base = defWith(trialWith('manual', el('TEXT_INSTRUCTION')));
    const frozen = JSON.stringify(base);
    const { definition: withTrial, trialId } = addTrial(base, base.trials[0].id);
    const { definition: withEl } = addElement(withTrial, trialId, 'YES_NO');
    duplicateTrialIn(withEl, trialId);
    moveTrial(withEl, trialId, -1);
    deleteTrial(withEl, base.trials[0].id);
    expect(JSON.stringify(base)).toBe(frozen);
    expect(withTrial.trials.map((t) => t.id)).toEqual([base.trials[0].id, trialId]);
  });

  it('moves trials and elements within bounds only', () => {
    const a = createTrial('a');
    const b = createTrial('b');
    const def = defWith(a, b);
    expect(moveTrial(def, b.id, -1).trials.map((t) => t.name)).toEqual(['b', 'a']);
    expect(moveTrial(def, a.id, -1)).toBe(def);
    expect(moveTrial(def, b.id, 1)).toBe(def);
    const x = el('TEXT_INSTRUCTION');
    const y = el('FIXATION_CROSS');
    const d2 = defWith(trialWith('manual', x, y));
    expect(moveElement(d2, d2.trials[0].id, y.id, -1).trials[0].elements.map((e) => e.id)).toEqual([y.id, x.id]);
  });

  it('duplicates an element right after the original with new ids', () => {
    const mc = el('MULTIPLE_CHOICE');
    const def = defWith(trialWith('response', mc));
    const out = duplicateElementIn(def, def.trials[0].id, mc.id);
    expect(out.trials[0].elements).toHaveLength(2);
    expect(out.trials[0].elements[1].id).not.toBe(mc.id);
  });

  it('clears the correct option or key when it is deleted', () => {
    const mc = el('MULTIPLE_CHOICE');
    const removed = mc.config.options[0].id;
    mc.scoring = { enabled: true, correctOptionId: removed };
    const after = removeChoiceOption(mc, removed);
    expect(after.scoring.correctOptionId).toBeNull();
    expect(after.config.options).toHaveLength(1);
    // Deleting a different option keeps the correct answer.
    mc.scoring.correctOptionId = mc.config.options[1].id;
    expect(removeChoiceOption(mc, removed).scoring.correctOptionId).toBe(mc.config.options[1].id);

    const kb = el('KEYBOARD_PRESS');
    kb.config.allowedKeys = ['a', 'l'];
    kb.scoring = { enabled: true, correctKey: 'a' };
    expect(removeAllowedKey(kb, 'a')).toMatchObject({ config: { allowedKeys: ['l'] }, scoring: { correctKey: null } });
  });

  it('updating a deleted element is a no-op (upload finishing after delete)', () => {
    const img = el('IMAGE_VISUAL');
    const def = defWith(trialWith('manual', img));
    const gone = deleteElement(def, def.trials[0].id, img.id);
    const after = updateElement(gone, def.trials[0].id, img.id, (e) => ({ ...e, id: 'x' }));
    expect(after).toBe(gone);
  });

  it('updates trial settings without touching elements', () => {
    const def = defWith(trialWith('manual', el('FIXATION_CROSS')));
    const out = updateTrial(def, def.trials[0].id, { advanceMode: 'timed', durationMs: 500 });
    expect(out.trials[0]).toMatchObject({ advanceMode: 'timed', durationMs: 500 });
    expect(out.trials[0].elements).toBe(def.trials[0].elements);
  });
});

describe('redactForParticipant', () => {
  it('removes every correct answer', () => {
    const kb = el('KEYBOARD_PRESS');
    kb.scoring = { enabled: true, correctKey: 'a' };
    const t = el('TEXT_INPUT');
    t.scoring = { enabled: true, acceptedAnswers: ['secret'], caseSensitive: false };
    const redacted = redactForParticipant(defWith(trialWith('response', kb, t)));
    const json = JSON.stringify(redacted);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('"correctKey":"a"');
  });
});
