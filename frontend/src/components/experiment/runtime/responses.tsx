"use client";
// Response inputs. They only report raw values upward; validation, timing and
// advancement are decided by the trial state machine in ExperimentRunner.

import { displayKey, type KeyboardPressElement, type MultipleChoiceElement, type SliderRatingElement, type TextInputElement, type YesNoElement } from '@/shared/experiment';

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

export function ChoiceInput({
  element,
  selected,
  disabled,
  onSelect,
}: {
  element: MultipleChoiceElement;
  selected: string | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}) {
  return (
    <fieldset className="w-full max-w-md space-y-3" disabled={disabled}>
      {element.config.prompt && <legend className="text-xl font-medium text-slate-900 mb-3 text-center w-full">{element.config.prompt}</legend>}
      {element.config.options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={selected === opt.id}
          onClick={() => onSelect(opt.id)}
          className={`block w-full min-h-12 px-4 py-3 border-2 rounded-xl text-lg font-medium transition-colors ${selected === opt.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
        >
          {opt.label}
        </button>
      ))}
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
  const { min, max, step, leftLabel, rightLabel, prompt, requireInteraction } = element.config;
  const id = `slider-${element.id}`;
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
        {requireInteraction && !touched ? '—' : value}
      </div>
      {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
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
  const { prompt, placeholder, multiline, maxLength } = element.config;
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
          type="text"
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
