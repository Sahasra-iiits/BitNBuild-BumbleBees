export type ElementRole = 'DISPLAY' | 'RESPONSE';

export type AdvanceMode = 'manual' | 'timed' | 'response' | 'response_or_timeout';

export type ScoringType = 'exact' | 'numeric_range' | 'set_membership' | 'boolean' | 'none';

export interface ScoringConfig {
  enabled: boolean;
  type: ScoringType;
  correctAnswer?: any;
}

export interface BaseElement {
  id: string;
  type: string;
  role: ElementRole;
}

export interface TextInstructionElement extends BaseElement {
  type: 'TEXT_INSTRUCTION';
  config: {
    text: string;
  };
}

export interface FixationCrossElement extends BaseElement {
  type: 'FIXATION_CROSS';
  config: {
    style: '+' | 'dot' | 'circle';
  };
}

export interface ImageVisualElement extends BaseElement {
  type: 'IMAGE_VISUAL';
  config: {
    url: string;
    altText?: string;
  };
}

export interface AudioSoundElement extends BaseElement {
  type: 'AUDIO_SOUND';
  config: {
    url: string;
    autoplay: boolean;
  };
}

export interface KeyboardPressElement extends BaseElement {
  type: 'KEYBOARD_PRESS';
  config: {
    allowedKeys: string[]; // empty array means any key
  };
  scoring: ScoringConfig;
}

export interface MouseClickElement extends BaseElement {
  type: 'MOUSE_CLICK';
  config: {};
  scoring: ScoringConfig;
}

export interface MultipleChoiceOption {
  id: string;
  label: string;
}

export interface MultipleChoiceElement extends BaseElement {
  type: 'MULTIPLE_CHOICE';
  config: {
    options: MultipleChoiceOption[];
  };
  scoring: ScoringConfig;
}

export interface SliderRatingElement extends BaseElement {
  type: 'SLIDER_RATING';
  config: {
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    leftLabel?: string;
    rightLabel?: string;
  };
  scoring: ScoringConfig;
}

export type ExperimentElement = 
  | TextInstructionElement
  | FixationCrossElement
  | ImageVisualElement
  | AudioSoundElement
  | KeyboardPressElement
  | MouseClickElement
  | MultipleChoiceElement
  | SliderRatingElement;

export interface Trial {
  id: string;
  name: string;
  elements: ExperimentElement[];
  advanceMode: AdvanceMode;
  durationMs: number | null; // Used if advanceMode is 'timed' or 'response_or_timeout'
}

export interface Experiment {
  id: string;
  title: string;
  description: string;
  trials: Trial[];
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9);
}

export function getDefaultScoring(): ScoringConfig {
  return { enabled: false, type: 'none' };
}
