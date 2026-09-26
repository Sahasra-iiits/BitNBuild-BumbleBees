import { CheckSquare, Crosshair, Image as ImageIcon, Keyboard, List, MousePointer2, SlidersHorizontal, TextCursorInput, Type, Volume2 } from 'lucide-react';
import type { ElementType } from '@/shared/experiment';

export const ELEMENT_META: Record<ElementType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  TEXT_INSTRUCTION: { label: 'Text', icon: Type, description: 'Instructions or a word stimulus' },
  FIXATION_CROSS: { label: 'Fixation', icon: Crosshair, description: 'Fixation point' },
  IMAGE_VISUAL: { label: 'Image', icon: ImageIcon, description: 'Uploaded or linked image' },
  AUDIO_SOUND: { label: 'Audio', icon: Volume2, description: 'Uploaded or linked sound' },
  KEYBOARD_PRESS: { label: 'Keyboard', icon: Keyboard, description: 'Key press with reaction time' },
  MOUSE_CLICK: { label: 'Click anywhere', icon: MousePointer2, description: 'Records click position' },
  MULTIPLE_CHOICE: { label: 'Multiple choice', icon: List, description: 'Pick one option' },
  SLIDER_RATING: { label: 'Slider', icon: SlidersHorizontal, description: 'Rating on a numeric scale' },
  TEXT_INPUT: { label: 'Text answer', icon: TextCursorInput, description: 'Typed answer' },
  YES_NO: { label: 'Yes / No', icon: CheckSquare, description: 'Two-button answer' },
};

export const STIMULUS_TYPES: ElementType[] = ['TEXT_INSTRUCTION', 'FIXATION_CROSS', 'IMAGE_VISUAL', 'AUDIO_SOUND'];
export const RESPONSE_TYPES: ElementType[] = ['KEYBOARD_PRESS', 'MULTIPLE_CHOICE', 'SLIDER_RATING', 'TEXT_INPUT', 'YES_NO', 'MOUSE_CLICK'];

export const ADVANCE_MODE_LABEL = {
  manual: 'Continue button',
  response: 'Ends on response',
  timed: 'Timed',
  response_or_timeout: 'Response or time limit',
} as const;

export const ADVANCE_MODE_HELP = {
  manual: 'Participants press Continue (enabled once required answers are given).',
  response: 'Ends as soon as all required answers are given. Trials with a slider or text answer end with a Submit button.',
  timed: 'Ends after the duration. Responses are recorded but do not end the trial.',
  response_or_timeout: 'Ends on the answer, or when the time limit is reached (recorded as a timeout).',
} as const;
