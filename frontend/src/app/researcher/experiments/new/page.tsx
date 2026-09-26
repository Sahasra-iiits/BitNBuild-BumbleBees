"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { experimentsApi } from '@/lib/api/experiments';
import { errorMessage } from '@/lib/api/client';
import { TextField } from '@/components/experiment/builder/fields';

export default function NewExperimentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const exp = await experimentsApi.create({ title: title.trim(), description: description.trim() || undefined, instructions: instructions.trim() || undefined });
      void queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
      router.push(`/researcher/experiments/${exp.id}/builder`);
    } catch (err) {
      setError(errorMessage(err, 'The experiment could not be created.'));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="max-w-2xl mx-auto bg-white rounded-xl border p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">New experiment</h1>
        <p className="text-slate-500 text-sm mt-1">You will build trials next. Visibility, reward and eligibility can be set later under Settings.</p>
      </div>
      <TextField label="Title" value={title} maxLength={300} placeholder="e.g. Visual working memory task" onChange={setTitle} />
      <TextField label="Description (shown to participants)" multiline value={description} maxLength={5000} onChange={setDescription} />
      <TextField label="Instructions (shown before consent)" multiline value={instructions} maxLength={10000} onChange={setInstructions} />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={!title.trim() || saving} className="px-5 py-2 rounded-md bg-blue-600 text-white font-medium disabled:opacity-40">
          {saving ? 'Creating…' : 'Create and open builder'}
        </button>
      </div>
    </form>
  );
}
