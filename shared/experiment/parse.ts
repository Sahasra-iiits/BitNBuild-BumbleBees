// Structural parsing of untrusted JSON into the canonical definition.
//
// Accepts the current schema (schemaVersion 2) and the legacy builder format
// (no schemaVersion, `scoring: { enabled, type, correctAnswer }`), and always
// returns a fully normalized ExperimentDefinition. Semantic problems (missing
// correct answer, empty text, ...) are NOT parse errors - drafts may be
// incomplete - they are reported by validateDefinition().

import { normalizeKey } from './keys';
import {
  ADVANCE_MODES,
  DEFINITION_SCHEMA_VERSION,
  type AdvanceMode,
  type ExperimentDefinition,
  type ExperimentElement,
  type FixationStyle,
  type MultipleChoiceOption,
  type Trial,
} from './types';

export class DefinitionParseError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DefinitionParseError';
    this.path = path;
  }
}

type Json = Record<string, unknown>;

const MAX_TRIALS = 1000;
const MAX_ELEMENTS_PER_TRIAL = 50;
const MAX_TEXT = 20000;
const MAX_OPTIONS = 50;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function obj(v: unknown, path: string): Json {
  if (v === undefined || v === null) return {};
  if (!isObject(v)) throw new DefinitionParseError(path, 'must be an object');
  return v;
}

function str(v: unknown, path: string, fallback = '', max = MAX_TEXT): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string') throw new DefinitionParseError(path, 'must be a string');
  if (v.length > max) throw new DefinitionParseError(path, `must be at most ${max} characters`);
  return v;
}

function id(v: unknown, path: string): string {
  const s = str(v, path, '', 100);
  if (!s.trim()) throw new DefinitionParseError(path, 'must be a non-empty id');
  return s;
}

function bool(v: unknown, path: string, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw new DefinitionParseError(path, 'must be a boolean');
  return v;
}

/** Accepts numbers and numeric strings (legacy slider responses were strings). */
function num(v: unknown, path: string, fallback: number): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new DefinitionParseError(path, 'must be a finite number');
  return n;
}

function numOrNull(v: unknown, path: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  return num(v, path, 0);
}

function arr(v: unknown, path: string, max: number): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new DefinitionParseError(path, 'must be an array');
  if (v.length > max) throw new DefinitionParseError(path, `must contain at most ${max} items`);
  return v;
}

/** Legacy drafts stored `{ enabled, type, correctAnswer }` for every response type. */
function legacyCorrectAnswer(scoring: Json): unknown {
  return scoring.correctAnswer;
}

function parseMedia(cfg: Json, path: string) {
  const assetIdRaw = cfg.assetId;
  const assetId =
    assetIdRaw === undefined || assetIdRaw === null || assetIdRaw === '' ? null : id(assetIdRaw, `${path}.assetId`);
  return {
    assetId,
    assetName: str(cfg.assetName, `${path}.assetName`, '', 300),
    url: assetId ? '' : str(cfg.url, `${path}.url`, '', 2048).trim(),
  };
}

function parseElement(raw: unknown, path: string): ExperimentElement {
  const el = obj(raw, path);
  const elementId = id(el.id, `${path}.id`);
  const type = str(el.type ?? el.elementType, `${path}.type`, '', 50);
  const cfg = obj(el.config, `${path}.config`);
  const scoring = obj(el.scoring, `${path}.scoring`);
  const required = bool(el.required, `${path}.required`, true);
  const scoringEnabled = bool(scoring.enabled, `${path}.scoring.enabled`, false);

  switch (type) {
    case 'TEXT_INSTRUCTION':
      return { id: elementId, type, role: 'DISPLAY', config: { text: str(cfg.text, `${path}.config.text`) } };
    case 'FIXATION_CROSS': {
      const style = str(cfg.style, `${path}.config.style`, '+', 10);
      if (!['+', 'dot', 'circle'].includes(style)) {
        throw new DefinitionParseError(`${path}.config.style`, 'must be one of +, dot, circle');
      }
      return { id: elementId, type, role: 'DISPLAY', config: { style: style as FixationStyle } };
    }
    case 'IMAGE_VISUAL':
      return {
        id: elementId,
        type,
        role: 'DISPLAY',
        config: { ...parseMedia(cfg, `${path}.config`), altText: str(cfg.altText, `${path}.config.altText`, '', 500) },
      };
    case 'AUDIO_SOUND':
      return {
        id: elementId,
        type,
        role: 'DISPLAY',
        config: { ...parseMedia(cfg, `${path}.config`), autoplay: bool(cfg.autoplay, `${path}.config.autoplay`, true) },
      };
    case 'KEYBOARD_PRESS': {
      const keys = arr(cfg.allowedKeys, `${path}.config.allowedKeys`, 50).map((k, i) =>
        normalizeKey(str(k, `${path}.config.allowedKeys[${i}]`, '', 30))
      );
      const correctRaw = scoring.correctKey ?? legacyCorrectAnswer(scoring);
      const correctKey =
        correctRaw === undefined || correctRaw === null || correctRaw === ''
          ? null
          : normalizeKey(str(correctRaw, `${path}.scoring.correctKey`, '', 30));
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: { allowedKeys: Array.from(new Set(keys.filter((k) => k.length > 0))) },
        scoring: { enabled: scoringEnabled, correctKey },
      };
    }
    case 'MOUSE_CLICK':
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: { prompt: str(cfg.prompt, `${path}.config.prompt`, 'Click anywhere to respond', 500) },
      };
    case 'MULTIPLE_CHOICE': {
      const options: MultipleChoiceOption[] = arr(cfg.options, `${path}.config.options`, MAX_OPTIONS).map((o, i) => {
        const opt = obj(o, `${path}.config.options[${i}]`);
        return { id: id(opt.id, `${path}.config.options[${i}].id`), label: str(opt.label, `${path}.config.options[${i}].label`, '', 500) };
      });
      const correctRaw = scoring.correctOptionId ?? legacyCorrectAnswer(scoring);
      const correctOptionId =
        correctRaw === undefined || correctRaw === null || correctRaw === ''
          ? null
          : str(correctRaw, `${path}.scoring.correctOptionId`, '', 100);
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: { prompt: str(cfg.prompt, `${path}.config.prompt`, '', 2000), options },
        scoring: { enabled: scoringEnabled, correctOptionId },
      };
    }
    case 'SLIDER_RATING': {
      const min = num(cfg.min, `${path}.config.min`, 1);
      const max = num(cfg.max, `${path}.config.max`, 7);
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: {
          prompt: str(cfg.prompt, `${path}.config.prompt`, '', 2000),
          min,
          max,
          step: num(cfg.step, `${path}.config.step`, 1),
          defaultValue: num(cfg.defaultValue, `${path}.config.defaultValue`, min),
          leftLabel: str(cfg.leftLabel, `${path}.config.leftLabel`, '', 200),
          rightLabel: str(cfg.rightLabel, `${path}.config.rightLabel`, '', 200),
          requireInteraction: bool(cfg.requireInteraction, `${path}.config.requireInteraction`, true),
        },
        scoring: {
          enabled: scoringEnabled,
          correctMin: numOrNull(scoring.correctMin, `${path}.scoring.correctMin`),
          correctMax: numOrNull(scoring.correctMax, `${path}.scoring.correctMax`),
        },
      };
    }
    case 'TEXT_INPUT': {
      const maxLengthRaw = numOrNull(cfg.maxLength, `${path}.config.maxLength`);
      const accepted = arr(scoring.acceptedAnswers, `${path}.scoring.acceptedAnswers`, 100).map((a, i) =>
        str(a, `${path}.scoring.acceptedAnswers[${i}]`, '', 1000)
      );
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: {
          prompt: str(cfg.prompt, `${path}.config.prompt`, '', 2000),
          placeholder: str(cfg.placeholder, `${path}.config.placeholder`, '', 300),
          multiline: bool(cfg.multiline, `${path}.config.multiline`, false),
          minLength: num(cfg.minLength, `${path}.config.minLength`, 0),
          maxLength: maxLengthRaw,
        },
        scoring: {
          enabled: scoringEnabled,
          acceptedAnswers: accepted,
          caseSensitive: bool(scoring.caseSensitive, `${path}.scoring.caseSensitive`, false),
        },
      };
    }
    case 'YES_NO': {
      const correctRaw = scoring.correctValue ?? legacyCorrectAnswer(scoring);
      const correctValue =
        correctRaw === undefined || correctRaw === null ? null : bool(correctRaw, `${path}.scoring.correctValue`, false);
      return {
        id: elementId,
        type,
        role: 'RESPONSE',
        required,
        config: {
          prompt: str(cfg.prompt, `${path}.config.prompt`, '', 2000),
          yesLabel: str(cfg.yesLabel, `${path}.config.yesLabel`, 'Yes', 100),
          noLabel: str(cfg.noLabel, `${path}.config.noLabel`, 'No', 100),
        },
        scoring: { enabled: scoringEnabled, correctValue },
      };
    }
    default:
      throw new DefinitionParseError(`${path}.type`, `unknown element type "${type}"`);
  }
}

function parseTrial(raw: unknown, path: string, index: number): Trial {
  const t = obj(raw, path);
  const mode = str(t.advanceMode, `${path}.advanceMode`, 'manual', 30);
  if (!(ADVANCE_MODES as readonly string[]).includes(mode)) {
    throw new DefinitionParseError(`${path}.advanceMode`, `must be one of ${ADVANCE_MODES.join(', ')}`);
  }
  const duration = numOrNull(t.durationMs, `${path}.durationMs`);
  return {
    id: id(t.id, `${path}.id`),
    name: str(t.name, `${path}.name`, `Trial ${index + 1}`, 300),
    advanceMode: mode as AdvanceMode,
    durationMs: duration,
    condition: str(t.condition, `${path}.condition`, '', 100).trim(),
    fixedPosition: bool(t.fixedPosition, `${path}.fixedPosition`, false),
    elements: arr(t.elements, `${path}.elements`, MAX_ELEMENTS_PER_TRIAL).map((e, i) =>
      parseElement(e, `${path}.elements[${i}]`)
    ),
  };
}

/** Parses and normalizes a definition. Throws DefinitionParseError on structural problems. */
export function parseDefinition(input: unknown): ExperimentDefinition {
  const root = obj(input, 'definition');
  const version = root.schemaVersion;
  if (version !== undefined && version !== 1 && version !== DEFINITION_SCHEMA_VERSION) {
    throw new DefinitionParseError('definition.schemaVersion', `unsupported schema version ${String(version)}`);
  }
  const settings = obj(root.settings, 'definition.settings');
  return {
    schemaVersion: DEFINITION_SCHEMA_VERSION,
    settings: { randomizeTrialOrder: bool(settings.randomizeTrialOrder, 'definition.settings.randomizeTrialOrder', false) },
    trials: arr(root.trials, 'definition.trials', MAX_TRIALS).map((t, i) => parseTrial(t, `definition.trials[${i}]`, i)),
  };
}

/**
 * Version snapshots written before schema 2 stored `{ title, ..., trials }` at the top level;
 * newer snapshots store `{ definition, settings }`.
 */
export function definitionFromSnapshot(snapshot: unknown): ExperimentDefinition {
  const snap = obj(snapshot, 'snapshot');
  if (snap.definition !== undefined) return parseDefinition(snap.definition);
  return parseDefinition({ trials: snap.trials ?? [] });
}
