"use client";
// Response inputs. They only report raw values upward; validation, timing and
// advancement are decided by the trial state machine in ExperimentRunner.

import { Star } from 'lucide-react';
import {
  displayKey,
  orderedOptions,
  type ChoiceGridElement,
  type DateTimeElement,
  type KeyboardPressElement,
  type MultipleChoiceElement,
  type SliderRatingElement,
  type TextInputElement,
  type YesNoElement,
} from '@/shared/experiment';

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="text-sm text-red-600 text-center" role="alert">
      {error}
    </p>
  ) : null;
}

export function KeyboardPrompt({ element, pressed }: { element: KeyboardPressElement; pressed: string | null }) {
  const keys = element.config.allowedKeys;
  return (
    <div className="flex flex-col items-center gap-2" aria-live="polite">
      <span className="text-xs uppercase tracking-widest font-semibold text-slate-400">{keys.length > 0 ? 'Press a key' : 'Press any key'}</span>
      {keys.length > 0 && (
        <div className="flex gap-3">
          {keys.map((k) => (
            <kbd
              key={k}
              className={`min-w-12 h-12 px-3 flex items-center justify-center rounded-lg border-2 border-b-4 font-mono text-lg font-bold ${pressed === k ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
            >
              {displayKey(k)}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Multiple choice in all three forms: single-choice buttons (instant), checkboxes
 * (multiple selection) and a dropdown. Option order may be shuffled per participant.
 */
export function ChoiceInput({
  element,
  selected,
  disabled,
  error,
  seed,
  onChange,
}: {
  element: MultipleChoiceElement;
  /** Selected option ids. */
  selected: string[];
  disabled: boolean;
  error: string | null;
  seed: string;
  onChange: (ids: string[]) => void;
}) {
  const { prompt, selection, display, shuffleOptions, minSelections, maxSelections } = element.config;
  const options = orderedOptions(element.config.options, shuffleOptions, `${seed}:${element.id}`);
  const id = `choice-${element.id}`;

  if (selection === 'single' && display === 'dropdown') {
    return (
      <div className="w-full max-w-md space-y-2">
        {prompt && (
          <label htmlFor={id} className="block text-xl font-medium text-slate-900 text-center">
            {prompt}
          </label>
        )}
        <select
          id={id}
          disabled={disabled}
          value={selected[0] ?? ''}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          className="w-full min-h-12 px-4 py-3 border-2 border-slate-300 rounded-xl text-lg bg-white focus:border-blue-500 outline-none"
        >
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <ErrorText error={error} />
      </div>
    );
  }

  const multiple = selection === 'multiple';
  const hint = multiple
    ? minSelections !== null && maxSelections !== null
      ? minSelections === maxSelections
        ? `Select exactly ${minSelections}`
        : `Select ${minSelections}–${maxSelections}`
      : minSelections !== null
        ? `Select at least ${minSelections}`
        : maxSelections !== null
          ? `Select up to ${maxSelections}`
          : 'Select all that apply'
    : null;

  // Long lists use two columns on wider screens so the whole question fits without scrolling.
  const many = options.length > 5;
  return (
    <fieldset className={`w-full ${many ? 'max-w-2xl' : 'max-w-xl'}`} disabled={disabled}>
      {prompt && <legend className="w-full text-center text-lg sm:text-xl font-semibold leading-snug text-slate-900 mb-2 break-words">{prompt}</legend>}
      {hint && <p className="text-sm text-slate-500 text-center mb-3">{hint}</p>}
      <div className={`grid gap-2.5 ${prompt && !hint ? 'mt-3' : ''} ${many ? 'sm:grid-cols-2' : ''}`}>
        {options.map((opt) => {
          const isOn = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              role={multiple ? 'checkbox' : undefined}
              aria-checked={multiple ? isOn : undefined}
              aria-pressed={multiple ? undefined : isOn}
              onClick={() => onChange(multiple ? (isOn ? selected.filter((s) => s !== opt.id) : [...selected, opt.id]) : [opt.id])}
              className={`flex items-center gap-3 w-full min-h-12 px-4 py-2.5 border-2 rounded-xl text-base sm:text-lg font-medium text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isOn ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
            >
              {/* Circle for one answer, square for several, as in paper and online forms. */}
              <span
                aria-hidden="true"
                className={`w-5 h-5 shrink-0 border-2 flex items-center justify-center text-xs ${multiple ? 'rounded' : 'rounded-full'} ${isOn ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}
              >
                {isOn ? (multiple ? '✓' : <span className="w-2 h-2 rounded-full bg-white" />) : ''}
              </span>
              <span className="flex-1 min-w-0 break-words">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <ErrorText error={error} />
    </fieldset>
  );
}

export function YesNoInput({ element, selected, disabled, onSelect }: { element: YesNoElement; selected: boolean | null; disabled: boolean; onSelect: (v: boolean) => void }) {
  return (
    <fieldset className="flex flex-col items-center gap-4" disabled={disabled}>
      {element.config.prompt && <legend className="text-xl font-medium text-slate-900 mb-3 text-center">{element.config.prompt}</legend>}
      <div className="flex gap-4">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
            className={`min-w-28 min-h-12 px-6 py-3 border-2 rounded-xl text-lg font-semibold transition-colors ${selected === value ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-300'}`}
          >
            {value ? element.config.yesLabel : element.config.noLabel}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Slider, linear scale (numbered buttons) or star rating — all record a number. */
export function SliderInput({
  element,
  value,
  touched,
  disabled,
  error,
  onChange,
}: {
  element: SliderRatingElement;
  value: number;
  touched: boolean;
  disabled: boolean;
  error: string | null;
  onChange: (v: number) => void;
}) {
  const { min, max, step, leftLabel, rightLabel, prompt, requireInteraction, display } = element.config;
  const id = `slider-${element.id}`;
  const points: number[] = [];
  if (display !== 'slider') for (let v = min; v <= max + 1e-9 && points.length < 11; v += step) points.push(Number(v.toFixed(10)));
  const chosen = touched || !requireInteraction ? value : null;

  if (display === 'scale' || display === 'stars') {
    return (
      <fieldset className="w-full max-w-2xl space-y-3" disabled={disabled}>
        {prompt && <legend className="block text-xl font-medium text-slate-900 text-center w-full mb-3">{prompt}</legend>}
        <div className="flex items-center justify-center gap-2 sm:gap-3" role="radiogroup" aria-label={prompt || 'Rating'}>
          {leftLabel && <span className="text-sm text-slate-500 text-right max-w-28">{leftLabel}</span>}
          {points.map((p) =>
            display === 'stars' ? (
              <button key={p} type="button" role="radio" aria-checked={chosen === p} aria-label={`${p} star${p === 1 ? '' : 's'}`} onClick={() => onChange(p)} className="p-1">
                <Star className={`w-9 h-9 ${chosen !== null && p <= chosen ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ) : (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={chosen === p}
                onClick={() => onChange(p)}
                className={`w-11 h-11 rounded-full border-2 text-base font-semibold ${chosen === p ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:border-blue-400'}`}
              >
                {p}
              </button>
            )
          )}
          {rightLabel && <span className="text-sm text-slate-500 max-w-28">{rightLabel}</span>}
        </div>
        <ErrorText error={error} />
      </fieldset>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-3">
      {prompt && (
        <label htmlFor={id} className="block text-xl font-medium text-slate-900 text-center">
          {prompt}
        </label>
      )}
      <div className="flex justify-between text-sm font-medium text-slate-500">
        <span>{leftLabel || min}</span>
        <span>{rightLabel || max}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={prompt || 'Rating'}
        aria-valuetext={String(value)}
        aria-invalid={!!error}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-3 cursor-pointer accent-blue-600 touch-pan-y ${requireInteraction && !touched ? 'opacity-60' : ''}`}
      />
      <div className="text-center text-lg font-semibold text-slate-800 tabular-nums" aria-hidden="true">
        {chosen === null ? '—' : value}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function TextAnswerInput({
  element,
  value,
  disabled,
  error,
  onChange,
}: {
  element: TextInputElement;
  value: string;
  disabled: boolean;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const { prompt, placeholder, multiline, maxLength, validation } = element.config;
  const id = `text-${element.id}`;
  const common = {
    id,
    value,
    disabled,
    placeholder,
    maxLength: maxLength ?? undefined,
    'aria-invalid': !!error,
    className: 'w-full p-4 border-2 border-slate-300 rounded-xl text-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none bg-white',
  };
  const inputType = validation.kind === 'email' ? 'email' : validation.kind === 'url' ? 'url' : 'text';
  return (
    <div className="w-full max-w-md space-y-2">
      {prompt && (
        <label htmlFor={id} className="block text-xl font-medium text-slate-900 text-center">
          {prompt}
        </label>
      )}
      {multiline ? (
        <textarea {...common} rows={4} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={inputType}
          inputMode={validation.kind === 'number' ? 'decimal' : undefined}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          // Enter never submits or ends a trial; answers are submitted with the button.
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
      )}
      <div className="flex justify-between text-xs text-slate-400">
        <span>{error ? <span className="text-red-600" role="alert">{error}</span> : element.required ? 'Required' : 'Optional'}</span>
        {maxLength !== null && (
          <span className="tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

export function DateTimeInput({ element, value, disabled, error, onChange }: { element: DateTimeElement; value: string; disabled: boolean; error: string | null; onChange: (v: string) => void }) {
  const id = `date-${element.id}`;
  const type = element.config.mode === 'date' ? 'date' : element.config.mode === 'time' ? 'time' : 'datetime-local';
  return (
    <div className="w-full max-w-xs space-y-2">
      {element.config.prompt && (
        <label htmlFor={id} className="block text-xl font-medium text-slate-900 text-center">
          {element.config.prompt}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        className="w-full p-3 border-2 border-slate-300 rounded-xl text-lg bg-white focus:border-blue-500 outline-none"
      />
      <ErrorText error={error} />
    </div>
  );
}

/** Multiple-choice grid (one per row) or checkbox grid. Scrolls horizontally on narrow screens. */
export function GridInput({
  element,
  value,
  disabled,
  error,
  onChange,
}: {
  element: ChoiceGridElement;
  value: Record<string, string[]>;
  disabled: boolean;
  error: string | null;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const { prompt, rows, columns, selection } = element.config;
  const toggle = (rowId: string, colId: string) => {
    const current = value[rowId] ?? [];
    const next = selection === 'single' ? [colId] : current.includes(colId) ? current.filter((c) => c !== colId) : [...current, colId];
    onChange({ ...value, [rowId]: next });
  };
  return (
    <fieldset className="w-full max-w-3xl space-y-3" disabled={disabled}>
      {prompt && <legend className="block text-xl font-medium text-slate-900 text-center w-full mb-3">{prompt}</legend>}
      <div className="overflow-x-auto">
        <table className="mx-auto text-sm">
          <thead>
            <tr>
              <th />
              {columns.map((c) => (
                <th key={c.id} scope="col" className="px-3 py-2 font-medium text-slate-600 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" role={selection === 'single' ? 'radiogroup' : 'group'} aria-label={r.label}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800">
                  {r.label}
                </th>
                {columns.map((c) => {
                  const on = (value[r.id] ?? []).includes(c.id);
                  return (
                    <td key={c.id} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        role={selection === 'single' ? 'radio' : 'checkbox'}
                        aria-checked={on}
                        aria-label={`${r.label}: ${c.label}`}
                        onClick={() => toggle(r.id, c.id)}
                        className={`w-7 h-7 border-2 ${selection === 'single' ? 'rounded-full' : 'rounded'} ${on ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorText error={error} />
    </fieldset>
  );
}
