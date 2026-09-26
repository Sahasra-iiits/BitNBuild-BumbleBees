// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.
// Centralized semantic validation. Errors block publishing; warnings must be
// acknowledged; info is advisory. The same function runs in the builder, on the
// publish page and on the server when publishing.

import { displayKey, isAssignableResponseKey } from './keys';
import type {
  ExperimentDefinition,
  ExperimentElement,
  IssueSeverity,
  Trial,
  ValidationIssue,
} from './types';
import { isResponseElement } from './types';

export const MIN_TRIAL_DURATION_MS = 50;
export const MAX_TRIAL_DURATION_MS = 60 * 60 * 1000;

export interface ValidationContext {
  /** Asset ids known to belong to this experiment. When provided, unknown references are errors. */
  knownAssetIds?: ReadonlySet<string>;
}

class IssueCollector {
  readonly issues: ValidationIssue[] = [];
  add(severity: IssueSeverity, code: string, message: string, trialId?: string, elementId?: string) {
    this.issues.push({ severity, code, message, trialId, elementId });
  }
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

function elementLabel(el: ExperimentElement): string {
  return el.type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function isMultipleOf(value: number, base: number, step: number): boolean {
  const n = (value - base) / step;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

function validateMedia(
  c: IssueCollector,
  el: ExperimentElement & { config: { assetId: string | null; url: string } },
  trial: Trial,
  ctx: ValidationContext,
  kind: 'image' | 'audio'
) {
  const { assetId, url } = el.config;
  if (!assetId && !url) {
    c.add('error', `${kind}_missing_source`, `${elementLabel(el)} has no file uploaded or URL set.`, trial.id, el.id);
    return;
  }
  if (assetId && ctx.knownAssetIds && !ctx.knownAssetIds.has(assetId)) {
    c.add('error', `${kind}_asset_not_found`, `${elementLabel(el)} references an uploaded file that no longer exists. Re-upload it.`, trial.id, el.id);
  }
  if (!assetId && url) {
    if (url.startsWith('asset://') || url.startsWith('blob:')) {
      c.add('error', `${kind}_local_reference`, `${elementLabel(el)} points to a file stored only in your browser. Re-upload the file so participants can load it.`, trial.id, el.id);
    } else if (!isHttpUrl(url)) {
      c.add('error', `${kind}_invalid_url`, `${elementLabel(el)} URL must start with http:// or https://.`, trial.id, el.id);
    } else if (url.startsWith('http://')) {
      c.add('warning', `${kind}_insecure_url`, `${elementLabel(el)} uses an insecure http:// URL; browsers may block it on https sites.`, trial.id, el.id);
    }
  }
}

function validateElement(c: IssueCollector, el: ExperimentElement, trial: Trial, ctx: ValidationContext) {
  switch (el.type) {
    case 'TEXT_INSTRUCTION':
      if (!el.config.text.trim()) c.add('error', 'text_empty', 'Text element has no text.', trial.id, el.id);
      break;
    case 'FIXATION_CROSS':
      break;
    case 'IMAGE_VISUAL':
      validateMedia(c, el, trial, ctx, 'image');
      if (!el.config.altText.trim()) {
        c.add('warning', 'image_missing_alt', 'Image has no alt text (needed for screen readers).', trial.id, el.id);
      }
      break;
    case 'AUDIO_SOUND':
      validateMedia(c, el, trial, ctx, 'audio');
      if (el.config.autoplay) {
        c.add('info', 'audio_autoplay', 'Browsers may block autoplay; participants will then see a Play button.', trial.id, el.id);
      }
      break;
    case 'KEYBOARD_PRESS': {
      const keys = el.config.allowedKeys;
      if (keys.length === 0) {
        c.add('warning', 'keyboard_any_key', 'No allowed keys set: any key will count as a response.', trial.id, el.id);
      }
      for (const k of keys) {
        if (!isAssignableResponseKey(k)) {
          c.add('error', 'keyboard_reserved_key', `Key "${displayKey(k)}" cannot be used as a response key.`, trial.id, el.id);
        }
      }
      if (el.scoring.enabled) {
        if (!el.scoring.correctKey) {
          c.add('error', 'keyboard_no_correct_key', 'Scoring is on but no correct key is selected.', trial.id, el.id);
        } else if (keys.length > 0 && !keys.includes(el.scoring.correctKey)) {
          c.add('error', 'keyboard_correct_key_not_allowed', `Correct key "${displayKey(el.scoring.correctKey)}" is not one of the allowed keys.`, trial.id, el.id);
        }
      }
      break;
    }
    case 'MOUSE_CLICK':
      break;
    case 'MULTIPLE_CHOICE': {
      const opts = el.config.options;
      if (opts.length < 2) c.add('error', 'mc_too_few_options', 'Multiple choice needs at least 2 options.', trial.id, el.id);
      if (opts.some((o) => !o.label.trim())) c.add('error', 'mc_empty_option', 'Multiple choice has an option with an empty label.', trial.id, el.id);
      const ids = new Set<string>();
      const labels = new Set<string>();
      for (const o of opts) {
        if (ids.has(o.id)) c.add('error', 'mc_duplicate_option_id', 'Multiple choice has duplicate option ids.', trial.id, el.id);
        ids.add(o.id);
        const norm = o.label.trim().toLowerCase();
        if (norm && labels.has(norm)) c.add('warning', 'mc_duplicate_label', `Option label "${o.label.trim()}" appears more than once.`, trial.id, el.id);
        labels.add(norm);
      }
      if (el.scoring.enabled) {
        if (!el.scoring.correctOptionId) {
          c.add('error', 'mc_no_correct_option', 'Scoring is on but no correct option is selected.', trial.id, el.id);
        } else if (!ids.has(el.scoring.correctOptionId)) {
          c.add('error', 'mc_correct_option_missing', 'The correct option was deleted. Select a new correct option.', trial.id, el.id);
        }
      }
      break;
    }
    case 'SLIDER_RATING': {
      const { min, max, step, defaultValue } = el.config;
      let rangeValid = true;
      if (!(min < max)) {
        c.add('error', 'slider_min_max', 'Slider minimum must be less than its maximum.', trial.id, el.id);
        rangeValid = false;
      }
      if (!(step > 0)) {
        c.add('error', 'slider_step', 'Slider step must be greater than 0.', trial.id, el.id);
        rangeValid = false;
      } else if (rangeValid && step > max - min) {
        c.add('error', 'slider_step_too_large', 'Slider step is larger than the slider range.', trial.id, el.id);
        rangeValid = false;
      }
      if (rangeValid) {
        if (defaultValue < min || defaultValue > max) {
          c.add('error', 'slider_default_range', 'Slider default value must be between minimum and maximum.', trial.id, el.id);
        } else if (!isMultipleOf(defaultValue, min, step)) {
          c.add('warning', 'slider_default_step', 'Slider default value is not on a step; it will snap to the nearest step.', trial.id, el.id);
        }
        if (!isMultipleOf(max, min, step)) {
          c.add('warning', 'slider_max_step', 'Slider maximum is not reachable with this step size.', trial.id, el.id);
        }
      }
      if (el.scoring.enabled) {
        const { correctMin, correctMax } = el.scoring;
        if (correctMin === null || correctMax === null) {
          c.add('error', 'slider_no_correct_range', 'Scoring is on but the correct value/range is not set.', trial.id, el.id);
        } else if (correctMin > correctMax) {
          c.add('error', 'slider_correct_range_order', 'Correct range lower bound is above its upper bound.', trial.id, el.id);
        } else if (rangeValid && (correctMin < min || correctMax > max)) {
          c.add('error', 'slider_correct_range_bounds', 'Correct range must lie within the slider range.', trial.id, el.id);
        }
      }
      break;
    }
    case 'TEXT_INPUT': {
      const { minLength, maxLength } = el.config;
      if (!Number.isInteger(minLength) || minLength < 0) {
        c.add('error', 'text_min_length', 'Minimum length must be a whole number of 0 or more.', trial.id, el.id);
      }
      if (maxLength !== null && (!Number.isInteger(maxLength) || maxLength < 1)) {
        c.add('error', 'text_max_length', 'Maximum length must be a whole number of 1 or more.', trial.id, el.id);
      } else if (maxLength !== null && maxLength < minLength) {
        c.add('error', 'text_length_order', 'Maximum length is smaller than minimum length.', trial.id, el.id);
      }
      if (!el.required && minLength > 0) {
        c.add('info', 'text_optional_min', 'Minimum length only applies when the participant types something.', trial.id, el.id);
      }
      if (el.scoring.enabled) {
        const answers = el.scoring.acceptedAnswers.filter((a) => a.trim().length > 0);
        if (answers.length === 0) {
          c.add('error', 'text_no_answers', 'Scoring is on but no accepted answers are listed.', trial.id, el.id);
        }
      }
      break;
    }
    case 'YES_NO':
      if (!el.config.yesLabel.trim() || !el.config.noLabel.trim()) {
        c.add('error', 'yesno_empty_label', 'Yes/No buttons need non-empty labels.', trial.id, el.id);
      }
      if (el.scoring.enabled && el.scoring.correctValue === null) {
        c.add('error', 'yesno_no_correct', 'Scoring is on but the correct answer (Yes or No) is not selected.', trial.id, el.id);
      }
      break;
  }
}

function validateTrial(c: IssueCollector, trial: Trial, index: number, ctx: ValidationContext) {
  const label = `Trial ${index + 1}${trial.name.trim() ? ` ("${trial.name.trim()}")` : ''}`;
  if (!trial.name.trim()) c.add('warning', 'trial_no_name', `${label} has no name.`, trial.id);
  if (trial.elements.length === 0) {
    c.add('error', 'trial_empty', `${label} has no elements.`, trial.id);
  }

  const responses = trial.elements.filter(isResponseElement);
  const timedMode = trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout';

  if (timedMode) {
    const d = trial.durationMs;
    if (d === null || !Number.isInteger(d) || d < MIN_TRIAL_DURATION_MS || d > MAX_TRIAL_DURATION_MS) {
      c.add(
        'error',
        'trial_duration',
        `${label} needs a whole-number duration between ${MIN_TRIAL_DURATION_MS} and ${MAX_TRIAL_DURATION_MS} ms.`,
        trial.id
      );
    }
  }

  if ((trial.advanceMode === 'response' || trial.advanceMode === 'response_or_timeout') && responses.length === 0) {
    c.add(
      'error',
      'trial_waits_for_missing_response',
      `${label} waits for a response but has no response elements. Add one or use "Continue button" / "Timed".`,
      trial.id
    );
  }
  if (trial.advanceMode === 'response' && responses.length > 0 && responses.every((r) => !r.required)) {
    c.add('warning', 'trial_all_optional', `${label} only has optional responses; it will end on the first response.`, trial.id);
  }
  if (trial.advanceMode === 'timed' && responses.length > 0) {
    c.add('info', 'trial_timed_responses', `${label} is timed: responses are recorded but do not end the trial.`, trial.id);
  }

  const mouse = responses.filter((r) => r.type === 'MOUSE_CLICK');
  if (mouse.length > 1) {
    c.add('error', 'trial_multiple_mouse', `${label} has more than one "click anywhere" response.`, trial.id);
  }
  if (mouse.length > 0 && responses.some((r) => r.type !== 'MOUSE_CLICK' && r.type !== 'KEYBOARD_PRESS')) {
    c.add('error', 'trial_mouse_conflict', `${label} combines "click anywhere" with clickable responses; clicks would be ambiguous.`, trial.id);
  }

  const keyboards = responses.filter((r) => r.type === 'KEYBOARD_PRESS');
  if (keyboards.length > 1) {
    const seen = new Set<string>();
    let anyKey = false;
    for (const kb of keyboards) {
      if (kb.type !== 'KEYBOARD_PRESS') continue;
      if (kb.config.allowedKeys.length === 0) anyKey = true;
      for (const k of kb.config.allowedKeys) {
        if (seen.has(k)) {
          c.add('error', 'trial_keyboard_overlap', `${label}: key "${displayKey(k)}" is used by more than one keyboard response.`, trial.id, kb.id);
        }
        seen.add(k);
      }
    }
    if (anyKey) {
      c.add('error', 'trial_keyboard_any_conflict', `${label} has several keyboard responses and one accepts any key.`, trial.id);
    }
  }

  const ids = new Set<string>();
  for (const el of trial.elements) {
    if (ids.has(el.id)) c.add('error', 'duplicate_element_id', `${label} contains duplicate element ids.`, trial.id, el.id);
    ids.add(el.id);
    validateElement(c, el, trial, ctx);
  }
}

export function validateDefinition(def: ExperimentDefinition, ctx: ValidationContext = {}): ValidationIssue[] {
  const c = new IssueCollector();
  if (def.trials.length === 0) {
    c.add('error', 'no_trials', 'The experiment has no trials.');
  }
  const trialIds = new Set<string>();
  const elementIds = new Set<string>();
  def.trials.forEach((trial, i) => {
    if (trialIds.has(trial.id)) c.add('error', 'duplicate_trial_id', `Trial ${i + 1} has a duplicate id.`, trial.id);
    trialIds.add(trial.id);
    for (const el of trial.elements) {
      if (elementIds.has(el.id)) c.add('error', 'duplicate_element_id_global', `Element id ${el.id} is used in more than one trial.`, trial.id, el.id);
      elementIds.add(el.id);
    }
    validateTrial(c, trial, i, ctx);
  });
  if (def.settings.randomizeTrialOrder && def.trials.length > 0 && def.trials.filter((t) => !t.fixedPosition).length < 2) {
    c.add('info', 'randomize_nothing', 'Trial order randomization is on, but fewer than two trials can move.');
  }
  return c.issues;
}

export function countBySeverity(issues: readonly ValidationIssue[]): Record<IssueSeverity, number> {
  const out: Record<IssueSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) out[i.severity] += 1;
  return out;
}

export function hasBlockingErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
