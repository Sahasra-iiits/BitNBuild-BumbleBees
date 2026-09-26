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

export function ChoiceEditor({ element, edit }: { element: MultipleChoiceElement; edit: Edit<MultipleChoiceElement> }) {
  const options = element.config.options;
  return (
    <div className="space-y-3">
      <TextField label="Question" value={element.config.prompt} onChange={(prompt) => edit((el) => ({ ...el, config: { ...el.config, prompt } }))} />
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600">Options</div>
        {options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-slate-400 text-right">{i + 1}.</span>
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
      <ScoringBox enabled={element.scoring.enabled} onToggle={(enabled) => edit((el) => ({ ...el, scoring: { ...el.scoring, enabled } }))}>
        <div role="radiogroup" aria-label="Correct option" className="flex flex-wrap gap-2">
          {options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={element.scoring.correctOptionId === opt.id}
              onClick={() => edit((el) => ({ ...el, scoring: { ...el.scoring, correctOptionId: opt.id } }))}
              className={`px-3 py-1 rounded-md border text-sm ${element.scoring.correctOptionId === opt.id ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'}`}
            >
              {opt.label.trim() || `Option ${i + 1}`}
            </button>
          ))}
        </div>
        {element.scoring.correctOptionId === null && <p className="text-xs text-red-600">Select the correct option.</p>}
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
      <Toggle label="Multi-line answer" checked={c.multiline} onChange={(multiline) => setConfig({ multiline })} />
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
