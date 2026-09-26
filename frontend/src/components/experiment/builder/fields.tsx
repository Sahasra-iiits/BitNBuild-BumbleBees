"use client";
import { useId, useState } from 'react';

export const inputClass =
  'w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white disabled:bg-slate-50';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, multiline, maxLength }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <textarea id={id} className={inputClass} rows={3} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input id={id} type="text" className={inputClass} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
}

/**
 * Numeric input that keeps what the user is typing ("-", "", "1.") locally and only
 * reports a value once it parses, so partial input never turns into 0.
 */
export function NumberField({
  label,
  value,
  onChange,
  allowNull = false,
  integer = false,
  min,
  hint,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowNull?: boolean;
  integer?: boolean;
  min?: number;
  hint?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [lastValue, setLastValue] = useState(value);
  // Adopt external changes (undo of a sibling edit, reload) without clobbering typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text) !== value || text.trim() === '') setText(value === null ? '' : String(value));
  }

  const parsed = text.trim() === '' ? null : Number(text);
  let error: string | null = null;
  if (parsed === null) error = allowNull ? null : 'Required';
  else if (!Number.isFinite(parsed)) error = 'Not a number';
  else if (integer && !Number.isInteger(parsed)) error = 'Whole number required';
  else if (min !== undefined && parsed < min) error = `Must be at least ${min}`;

  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={`${inputClass} ${error ? 'border-red-400' : ''}`}
          value={text}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const n = next.trim() === '' ? null : Number(next);
            if (n === null) {
              if (allowNull) {
                setLastValue(null);
                onChange(null);
              }
            } else if (Number.isFinite(n) && (!integer || Number.isInteger(n)) && (min === undefined || n >= min)) {
              setLastValue(n);
              onChange(n);
            }
          }}
        />
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600" />
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 ml-6">{hint}</p>}
    </div>
  );
}
