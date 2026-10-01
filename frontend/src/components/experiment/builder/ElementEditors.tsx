"use client";
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  createId,
  displayKey,
  isAssignableResponseKey,
  normalizeKey,
  removeAllowedKey,
  removeChoiceOption,
  removeGridColumn,
  removeGridRow,
  setChoiceSelection,
  type ChoiceGridElement,
  type DateTimeElement,
  type GridItem,
  type TextValidation,
  type FixationCrossElement,
  type KeyboardPressElement,
  type MouseClickElement,
  type MultipleChoiceElement,
  type SliderRatingElement,
  type TextInputElement,
  type TextInstructionElement,
  type YesNoElement,
} from '@/shared/experiment';
import { Field, inputClass, NumberField, TextField, Toggle } from './fields';

type Edit<T> = (fn: (el: T) => T) => void;

function ScoringBox({ enabled, onToggle, children }: { enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <Toggle label="Score this response (has a correct answer)" checked={enabled} onChange={onToggle} />
      {enabled && <div className="pl-6 space-y-3">{children}</div>}
    </div>
  );
}

export function TextInstructionEditor({ element, edit }: { element: TextInstructionElement; edit: Edit<TextInstructionElement> }) {
  return <TextField label="Text shown to participants" multiline value={element.config.text} onChange={(text) => edit((el) => ({ ...el, config: { text } }))} placeholder="Enter instructions or a stimulus word…" />;
}

export function FixationEditor({ element, edit }: { element: FixationCrossElement; edit: Edit<FixationCrossElement> }) {
  return (
    <Field label="Symbol">
      {(id) => (
        <select id={id} className={inputClass} value={element.config.style} onChange={(e) => edit((el) => ({ ...el, config: { style: e.target.value as FixationCrossElement['config']['style'] } }))}>
          <option value="+">Plus (+)</option>
          <option value="dot">Dot (•)</option>
          <option value="circle">Circle (○)</option>
        </select>
      )}
    </Field>
  );
}

export function KeyboardEditor({ element, edit }: { element: KeyboardPressElement; edit: Edit<KeyboardPressElement> }) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const keys = element.config.allowedKeys;

  const capture = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setListening(false);
      return;
    }
    const key = normalizeKey(e.key);
    if (!isAssignableResponseKey(key)) {
      setNotice(`"${e.key}" cannot be used as a response key.`);
      return;
    }
    setNotice(keys.includes(key) ? `${displayKey(key)} is already allowed.` : null);
    if (!keys.includes(key)) edit((el) => ({ ...el, config: { allowedKeys: [...el.config.allowedKeys, key] } }));
    setListening(false);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-600">Allowed keys</div>
      <div className="flex flex-wrap items-center gap-2">
        {keys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white border border-slate-300 rounded-md text-sm font-mono">
            {displayKey(k)}
            <button type="button" aria-label={`Remove key ${displayKey(k)}`} onClick={() => edit((el) => removeAllowedKey(el, k))} className="p-0.5 text-slate-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setListening(true);
          }}
          onKeyDown={capture}
          onBlur={() => setListening(false)}
          className={`px-3 py-1 border border-dashed rounded-md text-sm ${listening ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >
          {listening ? 'Press a key… (Esc to cancel)' : '+ Add key'}
        </button>
      </div>
      {notice && <p className="text-xs text-amber-700">{notice}</p>}
      {keys.length === 0 && <p className="text-xs text-slate-400">No keys set: any key (except Tab, Esc and modifiers) counts as a response.</p>}
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        {keys.length === 0 ? (
          <p className="text-xs text-red-600">Add the allowed keys first, then choose the correct one.</p>
        ) : (
          <div role="radiogroup" aria-label="Correct key" className="flex flex-wrap gap-2">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={element.scoring.correctKey === k}
                onClick={() => edit((el) => ({ ...el, scoring: { ...el.scoring, correctKey: k } }))}
                className={`px-3 py-1 rounded-md border text-sm font-mono ${element.scoring.correctKey === k ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'}`}
              >
                {displayKey(k)}
              </button>
            ))}
          </div>
        )}
      </ScoringBox>
    </div>
  );
}

export function MouseClickEditor({ element, edit }: { element: MouseClickElement; edit: Edit<MouseClickElement> }) {
  return (
    <div className="space-y-2">
      <TextField label="Prompt" value={element.config.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { prompt } }))} />
      <p className="text-xs text-slate-400">Records where the participant clicks (as a fraction of the screen). Click positions are not scored.</p>
    </div>
  );
}

function SegmentedChoice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-slate-300 overflow-hidden">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 text-sm border-r last:border-r-0 border-slate-300 ${value === v ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChoiceEditor({ element, edit }: { element: MultipleChoiceElement; edit: Edit<MultipleChoiceElement> }) {
  const { options, selection, display, shuffleOptions, minSelections, maxSelections } = element.config;
  const multiple = selection === 'multiple';
  const correct = element.scoring.correctOptionIds;
  const toggleCorrect = (id: string) =>
    edit((el) => ({
      ...el,
      scoring: {
        ...el.scoring,
        correctOptionIds: el.config.selection === 'single' ? [id] : el.scoring.correctOptionIds.includes(id) ? el.scoring.correctOptionIds.filter((x) => x !== id) : [...el.scoring.correctOptionIds, id],
      },
    }));

  return (
    <div className="space-y-3">
      <TextField label="Question" value={element.config.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { ...el.config, prompt } }))} />
      <div className="flex flex-wrap gap-4">
        <SegmentedChoice
          label="Answers allowed"
          value={selection}
          options={[
            ['single', 'One (single choice)'],
            ['multiple', 'Several (checkboxes)'],
          ]}
          onChange={(v) => edit((el) => setChoiceSelection(el, v))}
        />
        {!multiple && (
          <SegmentedChoice
            label="Shown as"
            value={display}
            options={[
              ['buttons', 'Buttons'],
              ['dropdown', 'Dropdown'],
            ]}
            onChange={(v) => edit((el) => ({ ...el, config: { ...el.config, display: v } }))}
          />
        )}
      </div>
      <p className="text-xs text-slate-400">
        {multiple || display === 'dropdown'
          ? 'Participants confirm their answer with Submit (or Continue).'
          : 'In “Ends on response” trials, clicking an option ends the trial immediately.'}
      </p>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">Options</div>
        {options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-slate-400 text-right">{multiple ? '☐' : `${i + 1}.`}</span>
            <input
              aria-label={`Option ${i + 1} label`}
              className={inputClass}
              value={opt.label}
              onChange={(e) => {
                const label = e.target.value;
                edit((el) => ({ ...el, config: { ...el.config, options: el.config.options.map((o) => (o.id === opt.id ? { ...o, label } : o)) } }));
              }}
            />
            <button
              type="button"
              aria-label={`Delete option ${i + 1}`}
              disabled={options.length <= 2}
              title={options.length <= 2 ? 'At least two options are needed' : 'Delete option'}
              onClick={() => edit((el) => removeChoiceOption(el, opt.id))}
              className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => edit((el) => ({ ...el, config: { ...el.config, options: [...el.config.options, { id: createId(), label: `Option ${el.config.options.length + 1}` }] } }))}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <Plus className="w-4 h-4" /> Add option
        </button>
      </div>
      <Toggle label="Shuffle option order for each participant" checked={shuffleOptions} onChange={(v) => edit((el) => ({ ...el, config: { ...el.config, shuffleOptions: v } }))} />
      {multiple && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="At least (optional)" integer min={1} allowNull value={minSelections} onChange={(v) => edit((el) => ({ ...el, config: { ...el.config, minSelections: v } }))} />
          <NumberField label="At most (optional)" integer min={1} allowNull value={maxSelections} onChange={(v) => edit((el) => ({ ...el, config: { ...el.config, maxSelections: v } }))} />
        </div>
      )}
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <p className="text-xs text-slate-500">{multiple ? 'Select every correct option. The answer counts as correct only if exactly these are ticked.' : 'Click the option that is correct.'}</p>
        <div role={multiple ? 'group' : 'radiogroup'} aria-label="Correct options" className="flex flex-wrap gap-2">
          {options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={correct.includes(opt.id)}
              onClick={() => toggleCorrect(opt.id)}
              className={`px-3 py-1 rounded-md border text-sm ${correct.includes(opt.id) ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'}`}
            >
              {opt.label.trim() || `Option ${i + 1}`}
            </button>
          ))}
        </div>
        {correct.length === 0 && <p className="text-xs text-red-600">Select the correct option{multiple ? '(s)' : ''}.</p>}
      </ScoringBox>
    </div>
  );
}

export function SliderEditor({ element, edit }: { element: SliderRatingElement; edit: Edit<SliderRatingElement> }) {
  const c = element.config;
  const setConfig = (patch: Partial<SliderRatingElement['config']>) => edit((el) => ({ ...el, config: { ...el.config, ...patch } }));
  return (
    <div className="space-y-3">
      <TextField label="Question" value={c.prompt} onChange={(prompt) => setConfig({ prompt })} />
      <SegmentedChoice
        label="Shown as"
        value={c.display}
        options={[
          ['slider', 'Slider'],
          ['scale', 'Linear scale'],
          ['stars', 'Star rating'],
        ]}
        onChange={(display) =>
          // Scales and stars use whole-number points; switching to them picks a sensible 1–5 default.
          setConfig(display === 'slider' ? { display } : { display, ...(c.max - c.min > 10 || !Number.isInteger(c.step) ? { min: 1, max: 5, step: 1, defaultValue: 3 } : {}) })
        }
      />
      {c.display !== 'slider' && <p className="text-xs text-slate-400">Linear scales and star ratings show one button per point (at most 11, e.g. 1–5 or 0–10).</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumberField label="Minimum" value={c.min} onChange={(v) => v !== null && setConfig({ min: v })} />
        <NumberField label="Maximum" value={c.max} onChange={(v) => v !== null && setConfig({ max: v })} />
        <NumberField label="Step" value={c.step} onChange={(v) => v !== null && setConfig({ step: v })} />
        <NumberField label="Start value" value={c.defaultValue} onChange={(v) => v !== null && setConfig({ defaultValue: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Left label" value={c.leftLabel} placeholder="e.g. Not at all" onChange={(leftLabel) => setConfig({ leftLabel })} />
        <TextField label="Right label" value={c.rightLabel} placeholder="e.g. Extremely" onChange={(rightLabel) => setConfig({ rightLabel })} />
      </div>
      <Toggle
        label="Participant must move the slider"
        hint="Prevents the start value from being submitted without a real answer."
        checked={c.requireInteraction}
        onChange={(requireInteraction) => setConfig({ requireInteraction })}
      />
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <p className="text-xs text-slate-500">Correct when the answer is within this range (set both to the same number for an exact value).</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="From" allowNull value={element.scoring.correctMin} onChange={(correctMin) => edit((el) => ({ ...el, scoring: { ...el.scoring, correctMin } }))} />
          <NumberField label="To" allowNull value={element.scoring.correctMax} onChange={(correctMax) => edit((el) => ({ ...el, scoring: { ...el.scoring, correctMax } }))} />
        </div>
      </ScoringBox>
    </div>
  );
}

export function TextInputEditor({ element, edit }: { element: TextInputElement; edit: Edit<TextInputElement> }) {
  const c = element.config;
  const setConfig = (patch: Partial<TextInputElement['config']>) => edit((el) => ({ ...el, config: { ...el.config, ...patch } }));
  return (
    <div className="space-y-3">
      <TextField label="Question" value={c.prompt} onChange={(prompt) => setConfig({ prompt })} />
      <TextField label="Placeholder" value={c.placeholder} onChange={(placeholder) => setConfig({ placeholder })} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Minimum length" integer min={0} value={c.minLength} onChange={(v) => v !== null && setConfig({ minLength: v })} />
        <NumberField label="Maximum length" integer min={1} allowNull placeholder="No limit" value={c.maxLength} onChange={(maxLength) => setConfig({ maxLength })} />
      </div>
      <Toggle label="Multi-line answer (paragraph)" checked={c.multiline} onChange={(multiline) => setConfig({ multiline })} />
      <TextValidationEditor value={c.validation} onChange={(validation) => setConfig({ validation })} />
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <TextField
          label="Accepted answers (one per line)"
          multiline
          value={element.scoring.acceptedAnswers.join('\n')}
          onChange={(v) => edit((el) => ({ ...el, scoring: { ...el.scoring, acceptedAnswers: v.split('\n') } }))}
          hint="Leading/trailing spaces are ignored and repeated spaces collapse."
        />
        <Toggle label="Case sensitive" checked={element.scoring.caseSensitive} onChange={(caseSensitive) => edit((el) => ({ ...el, scoring: { ...el.scoring, caseSensitive } }))} />
      </ScoringBox>
    </div>
  );
}

export function YesNoEditor({ element, edit }: { element: YesNoElement; edit: Edit<YesNoElement> }) {
  const c = element.config;
  return (
    <div className="space-y-3">
      <TextField label="Question" value={c.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { ...el.config, prompt } }))} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Yes label" value={c.yesLabel} onChange={(yesLabel) => edit((el) => ({ ...el, config: { ...el.config, yesLabel } }))} />
        <TextField label="No label" value={c.noLabel} onChange={(noLabel) => edit((el) => ({ ...el, config: { ...el.config, noLabel } }))} />
      </div>
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <div role="radiogroup" aria-label="Correct answer" className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={element.scoring.correctValue === v}
              onClick={() => edit((el) => ({ ...el, scoring: { ...el.scoring, correctValue: v } }))}
              className={`px-3 py-1 rounded-md border text-sm ${element.scoring.correctValue === v ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'}`}
            >
              {v ? c.yesLabel || 'Yes' : c.noLabel || 'No'}
            </button>
          ))}
        </div>
      </ScoringBox>
    </div>
  );
}

function TextValidationEditor({ value, onChange }: { value: TextValidation; onChange: (v: TextValidation) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Response validation">
        {(id) => (
          <select
            id={id}
            className={inputClass}
            value={value.kind}
            onChange={(e) => {
              const kind = e.target.value as TextValidation['kind'];
              onChange(
                kind === 'number'
                  ? { kind, min: null, max: null, integer: false }
                  : kind === 'regex'
                    ? { kind, pattern: '', message: '' }
                    : { kind }
              );
            }}
          >
            <option value="none">None</option>
            <option value="number">Number</option>
            <option value="email">Email address</option>
            <option value="url">Web address (URL)</option>
            <option value="regex">Pattern (regular expression)</option>
          </select>
        )}
      </Field>
      {value.kind === 'number' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Minimum" allowNull value={value.min} onChange={(min) => onChange({ ...value, min })} />
          <NumberField label="Maximum" allowNull value={value.max} onChange={(max) => onChange({ ...value, max })} />
          <Toggle label="Whole numbers only" checked={value.integer} onChange={(integer) => onChange({ ...value, integer })} />
        </div>
      )}
      {value.kind === 'regex' && (
        <div className="space-y-2">
          <TextField label="Pattern" value={value.pattern} placeholder="e.g. [A-Z]{3}[0-9]{2}" onChange={(pattern) => onChange({ ...value, pattern })} hint="The whole answer must match." />
          <TextField label="Error message for participants" value={value.message} placeholder="e.g. Enter a code like ABC12" onChange={(message) => onChange({ ...value, message })} />
        </div>
      )}
    </div>
  );
}

export function DateTimeEditor({ element, edit }: { element: DateTimeElement; edit: Edit<DateTimeElement> }) {
  const c = element.config;
  const inputType = c.mode === 'date' ? 'date' : c.mode === 'time' ? 'time' : 'datetime-local';
  return (
    <div className="space-y-3">
      <TextField label="Question" value={c.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { ...el.config, prompt } }))} />
      <SegmentedChoice
        label="Asks for"
        value={c.mode}
        options={[
          ['date', 'Date'],
          ['time', 'Time'],
          ['datetime', 'Date and time'],
        ]}
        onChange={(mode) => edit((el) => ({ ...el, config: { ...el.config, mode }, scoring: { ...el.scoring, correctValue: null } }))}
      />
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <Field label="Correct answer">
          {(id) => (
            <input
              id={id}
              type={inputType}
              className={inputClass}
              value={element.scoring.correctValue ?? ''}
              onChange={(e) => {
                const correctValue = e.target.value || null;
                edit((el) => ({ ...el, scoring: { ...el.scoring, correctValue } }));
              }}
            />
          )}
        </Field>
      </ScoringBox>
    </div>
  );
}

function GridItemsEditor({ title, items, onLabel, onAdd, onRemove, min }: { title: string; items: GridItem[]; onLabel: (id: string, label: string) => void; onAdd: () => void; onRemove: (id: string) => void; min: number }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <input aria-label={`${title.slice(0, -1)} ${i + 1} label`} className={inputClass} value={item.label} onChange={(e) => onLabel(item.id, e.target.value)} />
          <button type="button" aria-label={`Delete ${title.slice(0, -1).toLowerCase()} ${i + 1}`} disabled={items.length <= min} onClick={() => onRemove(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <Plus className="w-4 h-4" /> Add {title.slice(0, -1).toLowerCase()}
      </button>
    </div>
  );
}

export function GridEditor({ element, edit }: { element: ChoiceGridElement; edit: Edit<ChoiceGridElement> }) {
  const c = element.config;
  const relabel = (key: 'rows' | 'columns') => (id: string, label: string) =>
    edit((el) => ({ ...el, config: { ...el.config, [key]: el.config[key].map((x) => (x.id === id ? { ...x, label } : x)) } }));
  const add = (key: 'rows' | 'columns', name: string) => () =>
    edit((el) => ({ ...el, config: { ...el.config, [key]: [...el.config[key], { id: createId(), label: `${name} ${el.config[key].length + 1}` }] } }));
  const toggleCorrect = (rowId: string, colId: string) =>
    edit((el) => {
      const current = el.scoring.correctColumns[rowId] ?? [];
      const next = el.config.selection === 'single' ? (current.includes(colId) ? [] : [colId]) : current.includes(colId) ? current.filter((x) => x !== colId) : [...current, colId];
      return { ...el, scoring: { ...el.scoring, correctColumns: { ...el.scoring.correctColumns, [rowId]: next } } };
    });

  return (
    <div className="space-y-3">
      <TextField label="Question" value={c.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { ...el.config, prompt } }))} />
      <SegmentedChoice
        label="Each row allows"
        value={c.selection}
        options={[
          ['single', 'One answer (choice grid)'],
          ['multiple', 'Several (checkbox grid)'],
        ]}
        onChange={(selection) =>
          edit((el) => ({
            ...el,
            config: { ...el.config, selection },
            // Single-answer rows keep at most one correct column.
            scoring: selection === 'single' ? { ...el.scoring, correctColumns: Object.fromEntries(Object.entries(el.scoring.correctColumns).map(([r, cols]) => [r, cols.slice(0, 1)])) } : el.scoring,
          }))
        }
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <GridItemsEditor title="Rows" items={c.rows} min={1} onLabel={relabel('rows')} onAdd={add('rows', 'Row')} onRemove={(id) => edit((el) => removeGridRow(el, id))} />
        <GridItemsEditor title="Columns" items={c.columns} min={2} onLabel={relabel('columns')} onAdd={add('columns', 'Column')} onRemove={(id) => edit((el) => removeGridColumn(el, id))} />
      </div>
      <Toggle label="Require a response in each row" checked={c.requireEachRow} onChange={(requireEachRow) => edit((el) => ({ ...el, config: { ...el.config, requireEachRow } }))} hint="Applies when the question is required." />
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <p className="text-xs text-slate-500">Mark the correct column(s) per row. Rows without a correct answer are not scored.</p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th />
                {c.columns.map((col) => (
                  <th key={col.id} className="px-2 py-1 font-medium text-slate-600">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.id}>
                  <th className="px-2 py-1 text-left font-medium text-slate-700">{row.label}</th>
                  {c.columns.map((col) => {
                    const on = (element.scoring.correctColumns[row.id] ?? []).includes(col.id);
                    return (
                      <td key={col.id} className="px-2 py-1 text-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`Correct answer for ${row.label}: ${col.label}`}
                          onClick={() => toggleCorrect(row.id, col.id)}
                          className={`w-5 h-5 border-2 ${c.selection === 'single' ? 'rounded-full' : 'rounded'} ${on ? 'bg-emerald-600 border-emerald-700' : 'border-slate-300 hover:border-emerald-400'}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScoringBox>
    </div>
  );
}
