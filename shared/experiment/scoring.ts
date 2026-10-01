// Correctness scoring. Display elements and MOUSE_CLICK are never scored.
// A scored element that received no response (e.g. the trial timed out) is
// counted as incorrect so misses lower accuracy instead of disappearing.

import type { ExperimentElement, ResponseValue, Trial } from './types';
import { isScorableElement } from './types';

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((v) => sb.has(v));
}

function isGridValue(v: ResponseValue): v is Record<string, string[]> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => Array.isArray(x));
}

export function normalizeTextAnswer(value: string, caseSensitive: boolean): string {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

export function isScoringEnabled(element: ExperimentElement): boolean {
  return isScorableElement(element) && element.scoring.enabled;
}

export function scoreElement(element: ExperimentElement, value: ResponseValue | undefined): boolean | null {
  if (!isScorableElement(element) || !element.scoring.enabled) return null;
  if (value === undefined) return false;
  switch (element.type) {
    case 'KEYBOARD_PRESS':
      return element.scoring.correctKey !== null && value === element.scoring.correctKey;
    case 'MULTIPLE_CHOICE': {
      const correct = element.scoring.correctOptionIds;
      if (correct.length === 0) return false;
      if (element.config.selection === 'single') return typeof value === 'string' && correct.includes(value);
      return Array.isArray(value) && sameSet(value, correct);
    }
    case 'SLIDER_RATING': {
      const { correctMin, correctMax } = element.scoring;
      if (typeof value !== 'number' || correctMin === null || correctMax === null) return false;
      return value >= correctMin && value <= correctMax;
    }
    case 'TEXT_INPUT': {
      if (typeof value !== 'string') return false;
      const { acceptedAnswers, caseSensitive } = element.scoring;
      const given = normalizeTextAnswer(value, caseSensitive);
      return acceptedAnswers.some((a) => a.trim().length > 0 && normalizeTextAnswer(a, caseSensitive) === given);
    }
    case 'YES_NO':
      return element.scoring.correctValue !== null && value === element.scoring.correctValue;
    case 'DATE_TIME':
      return element.scoring.correctValue !== null && value === element.scoring.correctValue;
    case 'CHOICE_GRID': {
      const scoredRows = Object.entries(element.scoring.correctColumns).filter(([rowId, cols]) => cols.length > 0 && element.config.rows.some((r) => r.id === rowId));
      if (scoredRows.length === 0 || !isGridValue(value)) return false;
      return scoredRows.every(([rowId, cols]) => sameSet(value[rowId] ?? [], cols));
    }
  }
}

export interface TrialScore {
  /** true when every scored element is correct, false if any is incorrect, null when nothing is scored. */
  correct: boolean | null;
  byElement: Record<string, boolean | null>;
}

export function scoreTrial(trial: Trial, values: ReadonlyMap<string, ResponseValue>): TrialScore {
  const byElement: Record<string, boolean | null> = {};
  let anyScored = false;
  let allCorrect = true;
  for (const el of trial.elements) {
    const s = scoreElement(el, values.get(el.id));
    if (el.role === 'RESPONSE') byElement[el.id] = s;
    if (s !== null) {
      anyScored = true;
      if (!s) allCorrect = false;
    }
  }
  return { correct: anyScored ? allCorrect : null, byElement };
}
