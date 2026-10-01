import {
  AlignLeft,
  CalendarClock,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Crosshair,
  Grid3x3,
  Image as ImageIcon,
  Keyboard,
  ListChecks,
  MousePointer2,
  SlidersHorizontal,
  Star,
  TextCursorInput,
  Type,
  Volume2,
} from 'lucide-react';
import type { ElementType, ExperimentElement } from '@/shared/experiment';

type Icon = React.ComponentType<{ className?: string }>;

export const ELEMENT_META: Record<ElementType, { label: string; icon: Icon; description: string }> = {
  TEXT_INSTRUCTION: { label: 'Text', icon: Type, description: 'Instructions or a word stimulus' },
  FIXATION_CROSS: { label: 'Fixation', icon: Crosshair, description: 'Fixation point' },
  IMAGE_VISUAL: { label: 'Image', icon: ImageIcon, description: 'Uploaded or linked image' },
  AUDIO_SOUND: { label: 'Audio', icon: Volume2, description: 'Uploaded or linked sound' },
  KEYBOARD_PRESS: { label: 'Keyboard', icon: Keyboard, description: 'Key press with reaction time' },
  MOUSE_CLICK: { label: 'Click anywhere', icon: MousePointer2, description: 'Records click position' },
  MULTIPLE_CHOICE: { label: 'Multiple choice', icon: CircleDot, description: 'Pick one option' },
  SLIDER_RATING: { label: 'Slider', icon: SlidersHorizontal, description: 'Rating on a numeric scale' },
  TEXT_INPUT: { label: 'Short answer', icon: TextCursorInput, description: 'Typed answer' },
  YES_NO: { label: 'Yes / No', icon: CheckSquare, description: 'Two-button answer' },
  DATE_TIME: { label: 'Date / time', icon: CalendarClock, description: 'Date, time or both' },
  CHOICE_GRID: { label: 'Choice grid', icon: Grid3x3, description: 'Rows of questions sharing the same answer columns' },
};

/** Label for an existing element, reflecting its variant (e.g. Checkboxes, Linear scale). */
export function elementLabel(el: ExperimentElement): { label: string; icon: Icon } {
  if (el.type === 'MULTIPLE_CHOICE') {
    if (el.config.selection === 'multiple') return { label: 'Checkboxes', icon: ListChecks };
    if (el.config.display === 'dropdown') return { label: 'Dropdown', icon: ChevronDownSquare };
  }
  if (el.type === 'SLIDER_RATING') {
    if (el.config.display === 'scale') return { label: 'Linear scale', icon: SlidersHorizontal };
    if (el.config.display === 'stars') return { label: 'Star rating', icon: Star };
  }
  if (el.type === 'TEXT_INPUT' && el.config.multiline) return { label: 'Paragraph', icon: AlignLeft };
  if (el.type === 'CHOICE_GRID' && el.config.selection === 'multiple') return { label: 'Checkbox grid', icon: Grid3x3 };
  return { label: ELEMENT_META[el.type].label, icon: ELEMENT_META[el.type].icon };
}

export interface ElementPreset {
  key: string;
  label: string;
  icon: Icon;
  description: string;
  type: ElementType;
  /** Adjusts the freshly created element for this variant. */
  configure?: (el: ExperimentElement) => ExperimentElement;
}

const preset = (type: ElementType, extra: Partial<ElementPreset> = {}): ElementPreset => ({
  key: type,
  label: ELEMENT_META[type].label,
  icon: ELEMENT_META[type].icon,
  description: ELEMENT_META[type].description,
  type,
  ...extra,
});

export const STIMULUS_PRESETS: ElementPreset[] = [preset('TEXT_INSTRUCTION'), preset('FIXATION_CROSS'), preset('IMAGE_VISUAL'), preset('AUDIO_SOUND')];

export const RESPONSE_PRESETS: ElementPreset[] = [
  preset('MULTIPLE_CHOICE'),
  preset('MULTIPLE_CHOICE', {
    key: 'CHECKBOXES',
    label: 'Checkboxes',
    icon: ListChecks,
    description: 'Pick several options',
    configure: (el) => (el.type === 'MULTIPLE_CHOICE' ? { ...el, config: { ...el.config, selection: 'multiple' } } : el),
  }),
  preset('MULTIPLE_CHOICE', {
    key: 'DROPDOWN',
    label: 'Dropdown',
    icon: ChevronDownSquare,
    description: 'Pick one option from a list',
    configure: (el) => (el.type === 'MULTIPLE_CHOICE' ? { ...el, config: { ...el.config, display: 'dropdown' } } : el),
  }),
  preset('TEXT_INPUT'),
  preset('TEXT_INPUT', {
    key: 'PARAGRAPH',
    label: 'Paragraph',
    icon: AlignLeft,
    description: 'Long typed answer',
    configure: (el) => (el.type === 'TEXT_INPUT' ? { ...el, config: { ...el.config, multiline: true } } : el),
  }),
  preset('SLIDER_RATING', {
    key: 'LINEAR_SCALE',
    label: 'Linear scale',
    icon: SlidersHorizontal,
    description: 'Numbered points, e.g. 1 to 5',
    configure: (el) => (el.type === 'SLIDER_RATING' ? { ...el, config: { ...el.config, display: 'scale', min: 1, max: 5, step: 1, defaultValue: 3 } } : el),
  }),
  preset('SLIDER_RATING', {
    key: 'STARS',
    label: 'Star rating',
    icon: Star,
    description: '1 to 5 stars',
    configure: (el) => (el.type === 'SLIDER_RATING' ? { ...el, config: { ...el.config, display: 'stars', min: 1, max: 5, step: 1, defaultValue: 3 } } : el),
  }),
  preset('SLIDER_RATING'),
  preset('CHOICE_GRID'),
  preset('DATE_TIME'),
  preset('YES_NO'),
  preset('KEYBOARD_PRESS'),
  preset('MOUSE_CLICK'),
];

export const ADVANCE_MODE_LABEL = {
  manual: 'Continue button',
  response: 'Ends on response',
  timed: 'Timed',
  response_or_timeout: 'Response or time limit',
} as const;

export const ADVANCE_MODE_HELP = {
  manual: 'Participants press Continue (enabled once required answers are given).',
  response:
    'Ends as soon as all required answers are given. Trials with checkboxes, dropdowns, scales, sliders, text, dates or grids end with a Submit button.',
  timed: 'Ends after the duration. Responses are recorded but do not end the trial.',
  response_or_timeout: 'Ends on the answer, or when the time limit is reached (recorded as a timeout).',
} as const;
