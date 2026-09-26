// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.
// Immutable edit operations used by the builder. Every function returns a new
// definition and leaves its input untouched, and deleting something also cleans up
// every reference to it.

import { createElement, createTrial, duplicateElement, duplicateTrial } from './factory';
import type { ElementType, ExperimentDefinition, ExperimentElement, MultipleChoiceElement, Trial } from './types';

function mapTrial(def: ExperimentDefinition, trialId: string, fn: (t: Trial) => Trial): ExperimentDefinition {
  let changed = false;
  const trials = def.trials.map((t) => {
    if (t.id !== trialId) return t;
    const next = fn(t);
    if (next !== t) changed = true;
    return next;
  });
  return changed ? { ...def, trials } : def;
}

function move<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items as T[];
  const copy = items.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}

export function addTrial(def: ExperimentDefinition, afterTrialId?: string): { definition: ExperimentDefinition; trialId: string } {
  const trial = createTrial(`Trial ${def.trials.length + 1}`);
  const index = afterTrialId ? def.trials.findIndex((t) => t.id === afterTrialId) : -1;
  const trials = def.trials.slice();
  trials.splice(index === -1 ? trials.length : index + 1, 0, trial);
  return { definition: { ...def, trials }, trialId: trial.id };
}

export function updateTrial(def: ExperimentDefinition, trialId: string, patch: Partial<Omit<Trial, 'id' | 'elements'>>): ExperimentDefinition {
  return mapTrial(def, trialId, (t) => ({ ...t, ...patch }));
}

export function duplicateTrialIn(def: ExperimentDefinition, trialId: string): { definition: ExperimentDefinition; trialId: string | null } {
  const index = def.trials.findIndex((t) => t.id === trialId);
  if (index === -1) return { definition: def, trialId: null };
  const copy = duplicateTrial(def.trials[index]);
  const trials = def.trials.slice();
  trials.splice(index + 1, 0, copy);
  return { definition: { ...def, trials }, trialId: copy.id };
}

export function deleteTrial(def: ExperimentDefinition, trialId: string): ExperimentDefinition {
  const trials = def.trials.filter((t) => t.id !== trialId);
  return trials.length === def.trials.length ? def : { ...def, trials };
}

export function moveTrial(def: ExperimentDefinition, trialId: string, delta: number): ExperimentDefinition {
  const index = def.trials.findIndex((t) => t.id === trialId);
  const trials = move(def.trials, index, delta);
  return trials === def.trials ? def : { ...def, trials };
}

export function addElement(def: ExperimentDefinition, trialId: string, type: ElementType): { definition: ExperimentDefinition; elementId: string } {
  const element = createElement(type);
  return { definition: mapTrial(def, trialId, (t) => ({ ...t, elements: [...t.elements, element] })), elementId: element.id };
}

/** Replaces an element. A missing trial/element (e.g. deleted during an upload) is a no-op. */
export function updateElement(
  def: ExperimentDefinition,
  trialId: string,
  elementId: string,
  fn: (el: ExperimentElement) => ExperimentElement
): ExperimentDefinition {
  return mapTrial(def, trialId, (t) => {
    let changed = false;
    const elements = t.elements.map((el) => {
      if (el.id !== elementId) return el;
      const next = fn(el);
      if (next !== el) changed = true;
      return next;
    });
    return changed ? { ...t, elements } : t;
  });
}

export function deleteElement(def: ExperimentDefinition, trialId: string, elementId: string): ExperimentDefinition {
  return mapTrial(def, trialId, (t) => {
    const elements = t.elements.filter((el) => el.id !== elementId);
    return elements.length === t.elements.length ? t : { ...t, elements };
  });
}

export function duplicateElementIn(def: ExperimentDefinition, trialId: string, elementId: string): ExperimentDefinition {
  return mapTrial(def, trialId, (t) => {
    const index = t.elements.findIndex((el) => el.id === elementId);
    if (index === -1) return t;
    const elements = t.elements.slice();
    elements.splice(index + 1, 0, duplicateElement(t.elements[index]));
    return { ...t, elements };
  });
}

export function moveElement(def: ExperimentDefinition, trialId: string, elementId: string, delta: number): ExperimentDefinition {
  return mapTrial(def, trialId, (t) => {
    const elements = move(t.elements, t.elements.findIndex((el) => el.id === elementId), delta);
    return elements === t.elements ? t : { ...t, elements };
  });
}

/** Removes an option; if it was the correct answer, the correct answer is cleared (never reassigned). */
export function removeChoiceOption(el: MultipleChoiceElement, optionId: string): MultipleChoiceElement {
  return {
    ...el,
    config: { ...el.config, options: el.config.options.filter((o) => o.id !== optionId) },
    scoring: el.scoring.correctOptionId === optionId ? { ...el.scoring, correctOptionId: null } : el.scoring,
  };
}

/** Removes an allowed key and clears the correct key if it was that key. */
export function removeAllowedKey<T extends Extract<ExperimentElement, { type: 'KEYBOARD_PRESS' }>>(el: T, key: string): T {
  return {
    ...el,
    config: { ...el.config, allowedKeys: el.config.allowedKeys.filter((k) => k !== key) },
    scoring: el.scoring.correctKey === key ? { ...el.scoring, correctKey: null } : el.scoring,
  };
}
