"use client";
import { useEffect, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { IMPORT_LIMITS, parseQuestionFile, questionsToTrials, type ImportResult, type Trial } from '@/shared/experiment';
import { Field, inputClass, TextField } from './fields';

const SAMPLES: Record<'json' | 'csv' | 'aiken', { file: string; mime: string; content: string }> = {
  json: {
    file: 'questions-sample.json',
    mime: 'application/json',
    content: JSON.stringify(
      {
        questions: [
          { question: 'What is the capital of France?', options: ['Paris', 'Rome', 'Madrid'], answer: 'Paris' },
          { question: 'Which numbers are prime?', options: ['2', '3', '4', '9'], answer: ['2', '3'], type: 'multiple' },
          { question: 'Pick your favourite season', options: ['Spring', 'Summer', 'Autumn', 'Winter'], type: 'dropdown', required: false },
          { question: 'Which planet is largest?', options: ['Mars', 'Jupiter', 'Venus'], answer: 1, shuffle: true },
        ],
      },
      null,
      2
    ),
  },
  csv: {
    file: 'questions-sample.csv',
    mime: 'text/csv',
    content: [
      'question,option1,option2,option3,option4,answer,type,required,shuffle',
      'What is the capital of France?,Paris,Rome,Madrid,,Paris,single,yes,no',
      'Which numbers are prime?,2,3,4,9,A|B,multiple,yes,no',
      '"Pick your favourite season (optional, unscored)",Spring,Summer,Autumn,Winter,,dropdown,no,no',
      'Which planet is largest?,Mars,Jupiter,Venus,,B,single,yes,yes',
    ].join('\r\n'),
  },
  aiken: {
    file: 'questions-sample.txt',
    mime: 'text/plain',
    content: ['What is the capital of France?', 'A. Paris', 'B. Rome', 'C. Madrid', 'ANSWER: A', '', 'Which numbers are prime?', 'A. 2', 'B. 3', 'C. 4', 'D. 9', 'ANSWER: A, B', ''].join('\n'),
  },
};

function downloadSample(kind: keyof typeof SAMPLES) {
  const s = SAMPLES[kind];
  const url = URL.createObjectURL(new Blob([s.content], { type: s.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = s.file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Imports multiple-choice questions from a JSON / JS data, CSV or Aiken text file.
 * Nothing is added until the researcher reviews the parsed questions and confirms.
 */
export function ImportQuestionsDialog({ onClose, onImport, startNumber }: { onClose: () => void; onImport: (trials: Trial[]) => void; startNumber: number }) {
  const [result, setResult] = useState<(ImportResult & { fileName: string }) | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'response' | 'manual'>('response');
  const [condition, setCondition] = useState('');
  const [prefix, setPrefix] = useState('Question');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const readFile = async (file: File) => {
    setReadError(null);
    setResult(null);
    if (file.size > IMPORT_LIMITS.maxBytes) {
      setReadError('The file is larger than 2 MB.');
      return;
    }
    try {
      const text = await file.text();
      setResult({ ...parseQuestionFile(file.name, text), fileName: file.name });
    } catch {
      setReadError('The file could not be read.');
    }
  };

  const count = result?.questions.length ?? 0;
  const scored = result?.questions.filter((q) => q.correct.length > 0).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="import-title" className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 id="import-title" className="font-semibold text-lg">
            Import multiple-choice questions
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-sm text-slate-600 space-y-1">
            <p>Each question becomes its own trial. Supported formats:</p>
            <ul className="list-disc list-inside text-slate-500 text-xs space-y-0.5">
              <li>
                <strong>JSON</strong> (.json) or a JavaScript data file (.js — read as data, never run): an array of {'{ question, options, answer, type }'}. Numeric answers are 0-based indexes.
              </li>
              <li>
                <strong>CSV</strong> (.csv): columns question, option1…optionN (or A, B, C… or options separated by |), answer (label, letter or 1-based number; several separated by |), type, required, shuffle.
              </li>
              <li>
                <strong>Aiken</strong> (.txt): question line, options “A. …”, then “ANSWER: B” (or “ANSWER: A, C” for several).
              </li>
            </ul>
            <p className="text-xs">
              Samples:{' '}
              {(['json', 'csv', 'aiken'] as const).map((k, i) => (
                <span key={k}>
                  {i > 0 && ' · '}
                  <button type="button" onClick={() => downloadSample(k)} className="text-blue-600 hover:underline">
                    {SAMPLES[k].file}
                  </button>
                </span>
              ))}
            </p>
          </div>

          <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-6 cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
            <FileUp className="w-5 h-5" />
            {result ? `Selected: ${result.fileName} — choose another file` : 'Choose a .json, .js, .csv or .txt file'}
            <input
              type="file"
              accept=".json,.js,.mjs,.cjs,.csv,.txt,application/json,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = '';
              }}
            />
          </label>

          {readError && (
            <p className="text-sm text-red-600" role="alert">
              {readError}
            </p>
          )}

          {result && (
            <>
              <p className="text-sm" aria-live="polite">
                Read as <strong>{result.format === 'aiken' ? 'Aiken text' : result.format.toUpperCase()}</strong>: {count} question{count === 1 ? '' : 's'} ready ({scored} with a correct answer)
                {result.errors.length > 0 && <span className="text-red-600">, {result.errors.length} problem{result.errors.length === 1 ? '' : 's'}</span>}.
              </p>
              {result.errors.length > 0 && (
                <ul className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 space-y-0.5 max-h-32 overflow-y-auto" role="alert">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      {e.at !== null ? `${result.format === 'csv' ? 'Line' : 'Question'} ${e.at}: ` : ''}
                      {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {count > 0 && (
                <ol className="border rounded-md divide-y max-h-56 overflow-y-auto text-sm">
                  {result.questions.map((q, i) => (
                    <li key={i} className="px-3 py-2">
                      <div className="font-medium">
                        {i + 1}. {q.prompt}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({q.selection === 'multiple' ? 'checkboxes' : q.display === 'dropdown' ? 'dropdown' : 'single choice'}
                          {q.required ? '' : ', optional'}
                          {q.shuffle ? ', shuffled' : ''})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {q.options.map((o, oi) => (
                          <span key={oi} className={`px-2 py-0.5 rounded text-xs ${q.correct.includes(oi) ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-slate-100 text-slate-600'}`}>
                            {q.correct.includes(oi) ? '✓ ' : ''}
                            {o}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {count > 0 && (
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Trials end">
                    {(id) => (
                      <select id={id} className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as 'response' | 'manual')}>
                        <option value="response">On answer / Submit</option>
                        <option value="manual">With a Continue button</option>
                      </select>
                    )}
                  </Field>
                  <TextField label="Trial name prefix" value={prefix} maxLength={100} onChange={setPrefix} />
                  <TextField label="Condition label (optional)" value={condition} maxLength={100} onChange={setCondition} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => result && onImport(questionsToTrials(result.questions, { advanceMode: mode, condition: condition.trim(), namePrefix: prefix.trim() || 'Question', startNumber }))}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
          >
            Add {count} question{count === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
