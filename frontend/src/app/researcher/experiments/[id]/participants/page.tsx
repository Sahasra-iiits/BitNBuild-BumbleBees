"use client";
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { ExperimentHeader, useExperiment } from '@/components/researcher/ExperimentHeader';
import { NumberField, TextField, Toggle } from '@/components/experiment/builder/fields';
import type { AttemptPolicy, EligibilityRuleInput, ExperimentDetail, ExperimentVisibility } from '@/lib/types/api';

interface FormState {
  title: string;
  description: string;
  instructions: string;
  visibility: ExperimentVisibility;
  rewardPoints: number | null;
  attemptPolicy: AttemptPolicy;
  maxAttempts: number | null;
  ageEnabled: boolean;
  minAge: number | null;
  maxAge: number | null;
  ratingEnabled: boolean;
  minRating: number | null;
  maxRating: number | null;
  windowEnabled: boolean;
  availabilityStart: string;
  availabilityEnd: string;
}

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function fromExperiment(e: ExperimentDetail): FormState {
  const age = e.eligibilityRules.find((r) => r.ruleType === 'AGE_RANGE');
  const rating = e.eligibilityRules.find((r) => r.ruleType === 'RATING_RANGE');
  const window = e.eligibilityRules.find((r) => r.ruleType === 'AVAILABILITY_WINDOW');
  return {
    title: e.title,
    description: e.description ?? '',
    instructions: e.instructions ?? '',
    visibility: e.visibility,
    rewardPoints: e.rewardPoints,
    attemptPolicy: e.attemptPolicy,
    maxAttempts: e.maxAttempts,
    ageEnabled: !!age,
    minAge: age?.minAge ?? null,
    maxAge: age?.maxAge ?? null,
    ratingEnabled: !!rating,
    minRating: rating?.minRating ?? null,
    maxRating: rating?.maxRating ?? null,
    windowEnabled: !!window,
    availabilityStart: toLocalInput(window?.availabilityStart ?? null),
    availabilityEnd: toLocalInput(window?.availabilityEnd ?? null),
  };
}

function validate(f: FormState): string[] {
  const errors: string[] = [];
  if (!f.title.trim()) errors.push('Title is required.');
  if (f.rewardPoints === null || !Number.isInteger(f.rewardPoints) || f.rewardPoints < 0 || f.rewardPoints > 20) errors.push('Reward must be a whole number from 0 to 20.');
  if (f.attemptPolicy === 'ALLOW_MULTIPLE_ATTEMPTS' && (f.maxAttempts === null || !Number.isInteger(f.maxAttempts) || f.maxAttempts < 1 || f.maxAttempts > 100)) {
    errors.push('Maximum attempts must be a whole number from 1 to 100.');
  }
  if (f.ageEnabled) {
    if (f.minAge === null && f.maxAge === null) errors.push('Set a minimum or maximum age, or turn the age restriction off.');
    if ((f.minAge !== null && (f.minAge < 13 || f.minAge > 120)) || (f.maxAge !== null && (f.maxAge < 13 || f.maxAge > 120))) errors.push('Ages must be between 13 and 120.');
    if (f.minAge !== null && f.maxAge !== null && f.minAge > f.maxAge) errors.push('Minimum age is above maximum age.');
  }
  if (f.ratingEnabled) {
    if (f.minRating === null && f.maxRating === null) errors.push('Set a minimum or maximum rating, or turn the rating restriction off.');
    if ((f.minRating !== null && (f.minRating < 0 || f.minRating > 3000)) || (f.maxRating !== null && (f.maxRating < 0 || f.maxRating > 3000))) errors.push('Ratings must be between 0 and 3000.');
    if (f.minRating !== null && f.maxRating !== null && f.minRating > f.maxRating) errors.push('Minimum rating is above maximum rating.');
  }
  if (f.windowEnabled) {
    if (!f.availabilityStart && !f.availabilityEnd) errors.push('Set a start or end time, or turn the availability window off.');
    if (f.availabilityStart && f.availabilityEnd && f.availabilityStart > f.availabilityEnd) errors.push('Availability starts after it ends.');
  }
  return errors;
}

function toRules(f: FormState): EligibilityRuleInput[] {
  const rules: EligibilityRuleInput[] = [];
  if (f.ageEnabled) rules.push({ ruleType: 'AGE_RANGE', minAge: f.minAge ?? undefined, maxAge: f.maxAge ?? undefined });
  if (f.ratingEnabled) rules.push({ ruleType: 'RATING_RANGE', minRating: f.minRating ?? undefined, maxRating: f.maxRating ?? undefined });
  if (f.windowEnabled) {
    rules.push({
      ruleType: 'AVAILABILITY_WINDOW',
      availabilityStart: f.availabilityStart ? new Date(f.availabilityStart).toISOString() : undefined,
      availabilityEnd: f.availabilityEnd ? new Date(f.availabilityEnd).toISOString() : undefined,
    });
  }
  return rules;
}

export default function ExperimentSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment(id);
  return (
    <div className="max-w-3xl mx-auto">
      <ExperimentHeader id={id} />
      {experiment ? <SettingsForm key={experiment.id} experiment={experiment} /> : <p className="text-slate-500">Loading…</p>}
    </div>
  );
}

function SettingsForm({ experiment }: { experiment: ExperimentDetail }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => fromExperiment(experiment));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  };
  const errors = validate(form);
  const readOnly = experiment.status === 'ARCHIVED';

  const save = useMutation({
    mutationFn: () =>
      experimentsApi.update(experiment.id, {
        title: form.title.trim(),
        description: form.description,
        instructions: form.instructions,
        visibility: form.visibility,
        rewardPoints: form.rewardPoints ?? 0,
        attemptPolicy: form.attemptPolicy,
        maxAttempts: form.attemptPolicy === 'ALLOW_ONE_ATTEMPT' ? 1 : form.maxAttempts ?? 1,
        eligibilityRules: toRules(form),
      }),
    onSuccess: () => {
      setSavedAt(new Date());
      void queryClient.invalidateQueries({ queryKey: ['experiment', experiment.id] });
      void queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
    },
  });

  return (
    <form
      className="space-y-6 pb-12"
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length === 0 && !readOnly) save.mutate();
      }}
    >
      {readOnly && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Archived experiments are read-only.</p>}
      <fieldset disabled={readOnly || save.isPending} className="space-y-6">
        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Details</h2>
          <TextField label="Title" value={form.title} maxLength={300} onChange={(v) => set('title', v)} />
          <TextField label="Description (shown to participants)" multiline value={form.description} maxLength={5000} onChange={(v) => set('description', v)} />
          <TextField label="Instructions (shown before consent)" multiline value={form.instructions} maxLength={10000} onChange={(v) => set('instructions', v)} />
        </section>

        <section className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Visibility</h2>
          {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
            <label key={v} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${form.visibility === v ? 'border-blue-500 bg-blue-50' : ''}`}>
              <input type="radio" name="visibility" className="mt-1 accent-blue-600" checked={form.visibility === v} onChange={() => set('visibility', v)} />
              <span>
                <span className="block font-medium">{v === 'PUBLIC' ? 'Public' : 'Private link'}</span>
                <span className="block text-sm text-slate-500">{v === 'PUBLIC' ? 'Listed on the participant Discover page.' : 'Not listed; only participants with the link can take part.'}</span>
              </span>
            </label>
          ))}
        </section>

        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Reward and attempts</h2>
          <NumberField label="Reward points on completion (0–20)" integer min={0} allowNull value={form.rewardPoints} onChange={(v) => set('rewardPoints', v)} hint="Also raises the participant's rating by the same amount when no quality rule is triggered." />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="attempts" className="accent-blue-600" checked={form.attemptPolicy === 'ALLOW_ONE_ATTEMPT'} onChange={() => set('attemptPolicy', 'ALLOW_ONE_ATTEMPT')} />
              One attempt per participant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="attempts" className="accent-blue-600" checked={form.attemptPolicy === 'ALLOW_MULTIPLE_ATTEMPTS'} onChange={() => set('attemptPolicy', 'ALLOW_MULTIPLE_ATTEMPTS')} />
              Multiple responses from the same participant
            </label>
            {form.attemptPolicy === 'ALLOW_MULTIPLE_ATTEMPTS' && <NumberField label="Maximum completed attempts" integer min={1} allowNull value={form.maxAttempts} onChange={(v) => set('maxAttempts', v)} />}
          </div>
        </section>

        <section className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Eligibility</h2>
          <Toggle label="Restrict by age" checked={form.ageEnabled} onChange={(v) => set('ageEnabled', v)} />
          {form.ageEnabled && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <NumberField label="Minimum age" integer allowNull value={form.minAge} onChange={(v) => set('minAge', v)} />
              <NumberField label="Maximum age" integer allowNull value={form.maxAge} onChange={(v) => set('maxAge', v)} />
            </div>
          )}
          <Toggle label="Restrict by participant rating (0–3000, new participants start at 1200)" checked={form.ratingEnabled} onChange={(v) => set('ratingEnabled', v)} />
          {form.ratingEnabled && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <NumberField label="Minimum rating" allowNull value={form.minRating} onChange={(v) => set('minRating', v)} />
              <NumberField label="Maximum rating" allowNull value={form.maxRating} onChange={(v) => set('maxRating', v)} />
            </div>
          )}
          <Toggle label="Only available during a time window" checked={form.windowEnabled} onChange={(v) => set('windowEnabled', v)} />
          {form.windowEnabled && (
            <div className="grid sm:grid-cols-2 gap-3 pl-6">
              <label className="text-xs font-semibold text-slate-600 space-y-1">
                <span>Opens</span>
                <input type="datetime-local" className="w-full border rounded-md px-2 py-1.5 text-sm font-normal" value={form.availabilityStart} onChange={(e) => set('availabilityStart', e.target.value)} />
              </label>
              <label className="text-xs font-semibold text-slate-600 space-y-1">
                <span>Closes</span>
                <input type="datetime-local" className="w-full border rounded-md px-2 py-1.5 text-sm font-normal" value={form.availabilityEnd} onChange={(e) => set('availabilityEnd', e.target.value)} />
              </label>
            </div>
          )}
        </section>
      </fieldset>

      {errors.length > 0 && (
        <ul className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2 list-disc list-inside" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {save.isError && <p className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      <div className="flex items-center justify-end gap-3">
        {savedAt && <span className="text-sm text-emerald-700">Saved</span>}
        <button type="submit" disabled={errors.length > 0 || save.isPending || readOnly} className="px-5 py-2 rounded-md bg-blue-600 text-white font-medium disabled:opacity-40">
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
