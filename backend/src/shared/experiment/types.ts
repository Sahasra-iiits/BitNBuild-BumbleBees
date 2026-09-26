// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.
// Canonical experiment definition. This is the single representation used by the
// builder, validator, draft storage, preview, participant runtime, response
// recording and analysis.

export const DEFINITION_SCHEMA_VERSION = 2;

export type ElementRole = 'DISPLAY' | 'RESPONSE';

/**
 * manual              - a Continue button is shown; it is enabled once required responses are given.
 * response            - the trial ends when every required response element has been answered
 *                       (trials containing a slider or text input end on an explicit Submit).
 * timed               - the trial ends after durationMs; responses are recorded but never end the trial.
 * response_or_timeout - like `response`, but also ends after durationMs (recorded as a timeout).
 */
export type AdvanceMode = 'manual' | 'response' | 'timed' | 'response_or_timeout';

export const ADVANCE_MODES: readonly AdvanceMode[] = ['manual', 'response', 'timed', 'response_or_timeout'];

export type DisplayElementType = 'TEXT_INSTRUCTION' | 'FIXATION_CROSS' | 'IMAGE_VISUAL' | 'AUDIO_SOUND';
export type ResponseElementType =
  | 'KEYBOARD_PRESS'
  | 'MOUSE_CLICK'
  | 'MULTIPLE_CHOICE'
  | 'SLIDER_RATING'
  | 'TEXT_INPUT'
  | 'YES_NO';
export type ElementType = DisplayElementType | ResponseElementType;

export const DISPLAY_ELEMENT_TYPES: readonly DisplayElementType[] = [
  'TEXT_INSTRUCTION',
  'FIXATION_CROSS',
  'IMAGE_VISUAL',
  'AUDIO_SOUND',
];
export const RESPONSE_ELEMENT_TYPES: readonly ResponseElementType[] = [
  'KEYBOARD_PRESS',
  'MOUSE_CLICK',
  'MULTIPLE_CHOICE',
  'SLIDER_RATING',
  'TEXT_INPUT',
  'YES_NO',
];

export type FixationStyle = '+' | 'dot' | 'circle';

// ---------------------------------------------------------------------------
// Display elements (never scored)
// ---------------------------------------------------------------------------

export interface TextInstructionElement {
  id: string;
  type: 'TEXT_INSTRUCTION';
  role: 'DISPLAY';
  config: { text: string };
}

export interface FixationCrossElement {
  id: string;
  type: 'FIXATION_CROSS';
  role: 'DISPLAY';
  config: { style: FixationStyle };
}

/** Media comes either from an uploaded asset (assetId) or an external http(s) URL, never both. */
export interface MediaSourceConfig {
  assetId: string | null;
  assetName: string;
  url: string;
}

export interface ImageVisualElement {
  id: string;
  type: 'IMAGE_VISUAL';
  role: 'DISPLAY';
  config: MediaSourceConfig & { altText: string };
}

export interface AudioSoundElement {
  id: string;
  type: 'AUDIO_SOUND';
  role: 'DISPLAY';
  config: MediaSourceConfig & { autoplay: boolean };
}

// ---------------------------------------------------------------------------
// Response elements
// ---------------------------------------------------------------------------

export interface KeyboardPressElement {
  id: string;
  type: 'KEYBOARD_PRESS';
  role: 'RESPONSE';
  required: boolean;
  /** Normalized key names (see keys.ts). Empty means any non-modifier key. */
  config: { allowedKeys: string[] };
  scoring: { enabled: boolean; correctKey: string | null };
}

export interface MouseClickElement {
  id: string;
  type: 'MOUSE_CLICK';
  role: 'RESPONSE';
  required: boolean;
  config: { prompt: string };
}

export interface MultipleChoiceOption {
  id: string;
  label: string;
}

export interface MultipleChoiceElement {
  id: string;
  type: 'MULTIPLE_CHOICE';
  role: 'RESPONSE';
  required: boolean;
  config: { prompt: string; options: MultipleChoiceOption[] };
  scoring: { enabled: boolean; correctOptionId: string | null };
}

export interface SliderRatingElement {
  id: string;
  type: 'SLIDER_RATING';
  role: 'RESPONSE';
  required: boolean;
  config: {
    prompt: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    leftLabel: string;
    rightLabel: string;
    /** When true the participant must move the slider before the value counts as a response. */
    requireInteraction: boolean;
  };
  /** A response is correct when correctMin <= value <= correctMax (equal bounds = exact value). */
  scoring: { enabled: boolean; correctMin: number | null; correctMax: number | null };
}

export interface TextInputElement {
  id: string;
  type: 'TEXT_INPUT';
  role: 'RESPONSE';
  required: boolean;
  config: {
    prompt: string;
    placeholder: string;
    multiline: boolean;
    minLength: number;
    maxLength: number | null;
  };
  scoring: { enabled: boolean; acceptedAnswers: string[]; caseSensitive: boolean };
}

export interface YesNoElement {
  id: string;
  type: 'YES_NO';
  role: 'RESPONSE';
  required: boolean;
  config: { prompt: string; yesLabel: string; noLabel: string };
  scoring: { enabled: boolean; correctValue: boolean | null };
}

export type DisplayElement = TextInstructionElement | FixationCrossElement | ImageVisualElement | AudioSoundElement;
export type ResponseElement =
  | KeyboardPressElement
  | MouseClickElement
  | MultipleChoiceElement
  | SliderRatingElement
  | TextInputElement
  | YesNoElement;
export type ScorableElement = Exclude<ResponseElement, MouseClickElement>;
export type ExperimentElement = DisplayElement | ResponseElement;

// ---------------------------------------------------------------------------
// Trials and the definition
// ---------------------------------------------------------------------------

export interface Trial {
  id: string;
  name: string;
  advanceMode: AdvanceMode;
  /** Required for `timed` and `response_or_timeout`, ignored otherwise. */
  durationMs: number | null;
  /** Free-text experimental condition label used to group results. Empty = unlabeled. */
  condition: string;
  /** When trial-order randomization is on, fixed trials keep their position. */
  fixedPosition: boolean;
  elements: ExperimentElement[];
}

export interface DefinitionSettings {
  randomizeTrialOrder: boolean;
}

export interface ExperimentDefinition {
  schemaVersion: typeof DEFINITION_SCHEMA_VERSION;
  settings: DefinitionSettings;
  trials: Trial[];
}

// ---------------------------------------------------------------------------
// Recorded responses
// ---------------------------------------------------------------------------

export interface MouseClickValue {
  /** Position normalized to the viewport, 0..1. */
  x: number;
  y: number;
}

export type ResponseValue = string | number | boolean | MouseClickValue;

export interface ElementResponse {
  elementId: string;
  type: ResponseElementType;
  value: ResponseValue;
  /** Human-readable rendering of the value (option label, key name, Yes/No...). */
  display: string;
  /** Milliseconds from stimulus onset to this response (performance.now() based). */
  rtMs: number;
  /** Server/preview computed correctness; null when the element is not scored. */
  correct?: boolean | null;
}

export type AdvanceReason = 'response' | 'submit' | 'continue' | 'timeout';

export interface TrialResponsePayload {
  advanceReason: AdvanceReason;
  elements: ElementResponse[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  trialId?: string;
  elementId?: string;
}

export function isResponseElement(el: ExperimentElement): el is ResponseElement {
  return el.role === 'RESPONSE';
}

export function isScorableElement(el: ExperimentElement): el is ScorableElement {
  return el.role === 'RESPONSE' && el.type !== 'MOUSE_CLICK';
}

export function isDisplayElementType(type: string): type is DisplayElementType {
  return (DISPLAY_ELEMENT_TYPES as readonly string[]).includes(type);
}

export function isResponseElementType(type: string): type is ResponseElementType {
  return (RESPONSE_ELEMENT_TYPES as readonly string[]).includes(type);
}
