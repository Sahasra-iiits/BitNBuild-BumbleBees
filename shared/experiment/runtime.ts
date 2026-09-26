// Runtime rules shared by the preview, the participant runner and the server's
// response ingestion, so all three interpret a trial identically.

import { displayKey, isAssignableResponseKey } from './keys';
import type {
  ExperimentDefinition,
  ExperimentElement,
  MouseClickValue,
  ResponseElement,
  ResponseValue,
  Trial,
} from './types';
import { isResponseElement } from './types';

/** Slider and text responses change continuously, so they are committed with an explicit Submit. */
export function isDeferredResponseElement(el: ExperimentElement): boolean {
  return el.type === 'SLIDER_RATING' || el.type === 'TEXT_INPUT';
}

export function getResponseElements(trial: Trial): ResponseElement[] {
  return trial.elements.filter(isResponseElement);
}

/** True when the trial shows a Submit button (response modes with a slider or text input). */
export function trialUsesSubmit(trial: Trial): boolean {
  return (
    (trial.advanceMode === 'response' || trial.advanceMode === 'response_or_timeout') &&
    trial.elements.some(isDeferredResponseElement)
  );
}

export function trialHasTimer(trial: Trial): boolean {
  return (trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout') && (trial.durationMs ?? 0) > 0;
}

/** Every required response element has a valid value. */
export function requiredResponsesSatisfied(trial: Trial, answered: ReadonlySet<string>): boolean {
  return getResponseElements(trial).every((el) => !el.required || answered.has(el.id));
}

/**
 * Whether an instant response (key, choice, click) should end the trial right away:
 * only in `response`/`response_or_timeout` trials without a Submit button, once all
 * required responses are in (or, if every response is optional, on the first one).
 */
export function shouldAdvanceAfterInstantResponse(trial: Trial, answered: ReadonlySet<string>): boolean {
  if (trial.advanceMode !== 'response' && trial.advanceMode !== 'response_or_timeout') return false;
  if (trialUsesSubmit(trial)) return false;
  const responses = getResponseElements(trial);
  if (responses.length > 0 && responses.every((r) => !r.required)) return answered.size > 0;
  return requiredResponsesSatisfied(trial, answered);
}

export type CoerceResult = { ok: true; value: ResponseValue; display: string } | { ok: false; error: string };

function snapToStep(value: number, min: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  // Remove floating point noise such as 0.30000000000000004.
  return Number(snapped.toFixed(10));
}

/**
 * Validates and normalizes a raw response value for an element. Used by the client
 * before recording and by the server before storing, so invalid values never reach
 * the data set.
 */
export function coerceResponseValue(el: ExperimentElement, raw: unknown): CoerceResult {
  switch (el.type) {
    case 'KEYBOARD_PRESS': {
      if (typeof raw !== 'string' || raw.length === 0) return { ok: false, error: 'key must be a string' };
      const allowed = el.config.allowedKeys;
      if (allowed.length > 0 ? !allowed.includes(raw) : !isAssignableResponseKey(raw)) {
        return { ok: false, error: `key "${raw}" is not allowed` };
      }
      return { ok: true, value: raw, display: displayKey(raw) };
    }
    case 'MOUSE_CLICK': {
      const v = raw as Partial<MouseClickValue> | null;
      if (
        typeof v !== 'object' ||
        v === null ||
        typeof v.x !== 'number' ||
        typeof v.y !== 'number' ||
        !(v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1)
      ) {
        return { ok: false, error: 'click position must be normalized x/y between 0 and 1' };
      }
      const value = { x: Number(v.x.toFixed(4)), y: Number(v.y.toFixed(4)) };
      return { ok: true, value, display: `(${value.x}, ${value.y})` };
    }
    case 'MULTIPLE_CHOICE': {
      const opt = el.config.options.find((o) => o.id === raw);
      if (!opt) return { ok: false, error: 'unknown option' };
      return { ok: true, value: opt.id, display: opt.label };
    }
    case 'SLIDER_RATING': {
      const { min, max, step } = el.config;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, error: 'slider value must be a number' };
      if (raw < min - 1e-9 || raw > max + 1e-9) return { ok: false, error: `slider value must be between ${min} and ${max}` };
      const value = Math.min(max, Math.max(min, snapToStep(raw, min, step)));
      return { ok: true, value, display: String(value) };
    }
    case 'TEXT_INPUT': {
      if (typeof raw !== 'string') return { ok: false, error: 'text response must be a string' };
      const value = raw.trim();
      if (value.length === 0) return { ok: false, error: 'text response is empty' };
      if (value.length < el.config.minLength) return { ok: false, error: `text must be at least ${el.config.minLength} characters` };
      if (el.config.maxLength !== null && value.length > el.config.maxLength) {
        return { ok: false, error: `text must be at most ${el.config.maxLength} characters` };
      }
      return { ok: true, value, display: value };
    }
    case 'YES_NO': {
      if (typeof raw !== 'boolean') return { ok: false, error: 'yes/no response must be a boolean' };
      return { ok: true, value: raw, display: raw ? el.config.yesLabel : el.config.noLabel };
    }
    default:
      return { ok: false, error: `${el.type} does not accept responses` };
  }
}

// ---------------------------------------------------------------------------
// Trial order
// ---------------------------------------------------------------------------

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Presentation order as indexes into definition.trials. Deterministic for a given
 * seed (the session id), so the server can reproduce any participant's order.
 */
export function computeTrialOrder(def: ExperimentDefinition, seed: string): number[] {
  const order = def.trials.map((_, i) => i);
  if (!def.settings.randomizeTrialOrder) return order;
  const movable = order.filter((i) => !def.trials[i].fixedPosition);
  const rand = mulberry32(hashSeed(seed));
  for (let i = movable.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }
  let next = 0;
  return order.map((i) => (def.trials[i].fixedPosition ? i : movable[next++]));
}

/** Copy of the definition without correct answers, for delivery to participants. */
export function redactForParticipant(def: ExperimentDefinition): ExperimentDefinition {
  return {
    ...def,
    trials: def.trials.map((t) => ({
      ...t,
      elements: t.elements.map((el): ExperimentElement => {
        switch (el.type) {
          case 'KEYBOARD_PRESS':
            return { ...el, scoring: { enabled: false, correctKey: null } };
          case 'MULTIPLE_CHOICE':
            return { ...el, scoring: { enabled: false, correctOptionId: null } };
          case 'SLIDER_RATING':
            return { ...el, scoring: { enabled: false, correctMin: null, correctMax: null } };
          case 'TEXT_INPUT':
            return { ...el, scoring: { enabled: false, acceptedAnswers: [], caseSensitive: false } };
          case 'YES_NO':
            return { ...el, scoring: { enabled: false, correctValue: null } };
          default:
            return el;
        }
      }),
    })),
  };
}

/** Asset ids referenced anywhere in the definition. */
export function collectAssetIds(def: ExperimentDefinition): string[] {
  const ids = new Set<string>();
  for (const t of def.trials) {
    for (const el of t.elements) {
      if ((el.type === 'IMAGE_VISUAL' || el.type === 'AUDIO_SOUND') && el.config.assetId) ids.add(el.config.assetId);
    }
  }
  return Array.from(ids);
}

/** Deterministic JSON serialization (sorted keys) used for hashing and change detection. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}
