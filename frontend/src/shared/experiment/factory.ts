// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.
import { createId } from './ids';
import {
  DEFINITION_SCHEMA_VERSION,
  type ElementType,
  type ExperimentDefinition,
  type ExperimentElement,
  type Trial,
} from './types';

export function createEmptyDefinition(): ExperimentDefinition {
  return { schemaVersion: DEFINITION_SCHEMA_VERSION, settings: { randomizeTrialOrder: false }, trials: [] };
}

export function createTrial(name: string): Trial {
  return {
    id: createId(),
    name,
    advanceMode: 'manual',
    durationMs: null,
    condition: '',
    fixedPosition: false,
    elements: [],
  };
}

export function createElement(type: ElementType): ExperimentElement {
  const id = createId();
  switch (type) {
    case 'TEXT_INSTRUCTION':
      return { id, type, role: 'DISPLAY', config: { text: '' } };
    case 'FIXATION_CROSS':
      return { id, type, role: 'DISPLAY', config: { style: '+' } };
    case 'IMAGE_VISUAL':
      return { id, type, role: 'DISPLAY', config: { assetId: null, assetName: '', url: '', altText: '' } };
    case 'AUDIO_SOUND':
      return { id, type, role: 'DISPLAY', config: { assetId: null, assetName: '', url: '', autoplay: true } };
    case 'KEYBOARD_PRESS':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: { allowedKeys: [] },
        scoring: { enabled: false, correctKey: null },
      };
    case 'MOUSE_CLICK':
      return { id, type, role: 'RESPONSE', required: true, config: { prompt: 'Click anywhere to respond' } };
    case 'MULTIPLE_CHOICE':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: {
          prompt: '',
          options: [
            { id: createId(), label: 'Option 1' },
            { id: createId(), label: 'Option 2' },
          ],
          selection: 'single',
          display: 'buttons',
          shuffleOptions: false,
          minSelections: null,
          maxSelections: null,
        },
        scoring: { enabled: false, correctOptionIds: [] },
      };
    case 'SLIDER_RATING':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: {
          prompt: '',
          display: 'slider',
          min: 1,
          max: 7,
          step: 1,
          defaultValue: 4,
          leftLabel: '',
          rightLabel: '',
          requireInteraction: true,
        },
        scoring: { enabled: false, correctMin: null, correctMax: null },
      };
    case 'TEXT_INPUT':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: { prompt: '', placeholder: '', multiline: false, minLength: 0, maxLength: null, validation: { kind: 'none' } },
        scoring: { enabled: false, acceptedAnswers: [], caseSensitive: false },
      };
    case 'YES_NO':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: { prompt: '', yesLabel: 'Yes', noLabel: 'No' },
        scoring: { enabled: false, correctValue: null },
      };
    case 'DATE_TIME':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: { prompt: '', mode: 'date' },
        scoring: { enabled: false, correctValue: null },
      };
    case 'CHOICE_GRID':
      return {
        id,
        type,
        role: 'RESPONSE',
        required: true,
        config: {
          prompt: '',
          rows: [
            { id: createId(), label: 'Row 1' },
            { id: createId(), label: 'Row 2' },
          ],
          columns: [
            { id: createId(), label: 'Column 1' },
            { id: createId(), label: 'Column 2' },
          ],
          selection: 'single',
          requireEachRow: true,
        },
        scoring: { enabled: false, correctColumns: {} },
      };
  }
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep copy with fresh element and option IDs; the correct-option reference follows its option. */
export function duplicateElement(element: ExperimentElement): ExperimentElement {
  const copy = deepCopy(element);
  copy.id = createId();
  if (copy.type === 'MULTIPLE_CHOICE') {
    const idMap = new Map<string, string>();
    copy.config.options = copy.config.options.map((opt) => {
      const newId = createId();
      idMap.set(opt.id, newId);
      return { ...opt, id: newId };
    });
    copy.scoring.correctOptionIds = copy.scoring.correctOptionIds.map((id) => idMap.get(id)).filter((id): id is string => !!id);
  }
  if (copy.type === 'CHOICE_GRID') {
    const rowMap = new Map<string, string>();
    const colMap = new Map<string, string>();
    copy.config.rows = copy.config.rows.map((r) => {
      const newId = createId();
      rowMap.set(r.id, newId);
      return { ...r, id: newId };
    });
    copy.config.columns = copy.config.columns.map((c) => {
      const newId = createId();
      colMap.set(c.id, newId);
      return { ...c, id: newId };
    });
    const correct: Record<string, string[]> = {};
    for (const [rowId, cols] of Object.entries(copy.scoring.correctColumns)) {
      const newRow = rowMap.get(rowId);
      if (newRow) correct[newRow] = cols.map((c) => colMap.get(c)).filter((c): c is string => !!c);
    }
    copy.scoring.correctColumns = correct;
  }
  return copy;
}

export function duplicateTrial(trial: Trial): Trial {
  const copy = deepCopy(trial);
  return {
    ...copy,
    id: createId(),
    name: `${trial.name} (Copy)`,
    elements: trial.elements.map(duplicateElement),
  };
}
