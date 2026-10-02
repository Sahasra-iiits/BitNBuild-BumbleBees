// GENERATED FILE - edit shared/experiment and run `node scripts/sync-shared.mjs`.
// Importing multiple-choice questions from files.
//
// Supported formats:
//  - JSON (.json) and JavaScript data files (.js/.mjs) — an array of questions, or
//    { "questions": [...] }. JavaScript files are read as data (object/array literal
//    after `export default` / `module.exports =`); they are never executed.
//  - CSV (.csv) — one question per row with a header row.
//  - Aiken (.txt) — the plain-text MCQ format used by Moodle:
//        What is 2 + 2?
//        A. 3
//        B. 4
//        ANSWER: B
//
// The result is a list of questions plus per-question errors, which the builder
// shows before anything is added to the experiment.

import { createElement, createTrial } from './factory';
import { createId } from './ids';
import type { AdvanceMode, ChoiceDisplay, ChoiceSelection, MultipleChoiceElement, Trial } from './types';

export type ImportFormat = 'json' | 'csv' | 'aiken';

export interface ImportedQuestion {
  prompt: string;
  options: string[];
  /** Zero-based indexes of the correct options (empty = not scored). */
  correct: number[];
  selection: ChoiceSelection;
  display: ChoiceDisplay;
  required: boolean;
  shuffle: boolean;
  element_type?: 'MULTIPLE_CHOICE' | 'SLIDER_RATING' | 'TEXT_INPUT';
  min?: number;
  max?: number;
  step?: number;
}

export interface ImportIssue {
  /** 1-based question number (JSON/Aiken) or line number (CSV); null for file-level problems. */
  at: number | null;
  message: string;
}

export interface ImportResult {
  format: ImportFormat;
  questions: ImportedQuestion[];
  errors: ImportIssue[];
}

export const IMPORT_LIMITS = { maxQuestions: 500, maxOptions: 50, maxBytes: 2 * 1024 * 1024 } as const;

export function detectImportFormat(fileName: string, text: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.txt')) return 'aiken';
  const t = text.trimStart();
  if (t.startsWith('[') || t.startsWith('{') || /^(export|module\.exports|const|let|var)\b/.test(t)) return 'json';
  return /^ANSWER\s*:/im.test(text) ? 'aiken' : 'csv';
}

export function parseQuestionFile(fileName: string, text: string): ImportResult {
  const format = detectImportFormat(fileName, text);
  if (text.length > IMPORT_LIMITS.maxBytes) {
    return { format, questions: [], errors: [{ at: null, message: 'The file is larger than 2 MB.' }] };
  }
  const clean = text.replace(/^﻿/, '');
  const result = format === 'json' ? parseJsonQuestions(clean) : format === 'csv' ? parseCsvQuestions(clean) : parseAikenQuestions(clean);
  if (result.questions.length > IMPORT_LIMITS.maxQuestions) {
    result.errors.push({ at: null, message: `Only the first ${IMPORT_LIMITS.maxQuestions} questions are imported.` });
    result.questions = result.questions.slice(0, IMPORT_LIMITS.maxQuestions);
  }
  if (result.questions.length === 0 && result.errors.length === 0) result.errors.push({ at: null, message: 'No questions were found in the file.' });
  return { format, ...result };
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Resolves an answer given as an option label, a letter (A, B…) or a number. */
function resolveAnswer(raw: unknown, options: string[], numberBase: 0 | 1, numericTextIsPosition: boolean): number | string {
  if (typeof raw === 'number') {
    const index = raw - numberBase;
    return Number.isInteger(raw) && index >= 0 && index < options.length ? index : `answer ${raw} is not a valid option number`;
  }
  if (typeof raw === 'string' && !numericTextIsPosition && /^\d+$/.test(raw.trim())) {
    // JSON numbers are already typed; a quoted "2" means the option whose text is 2.
    const byText = options.findIndex((o) => o.trim() === raw.trim());
    return byText !== -1 ? byText : `answer "${raw.trim()}" does not match any option`;
  }
  if (typeof raw !== 'string') return 'answers must be option labels, letters or numbers';
  const value = raw.trim();
  const byLabel = options.findIndex((o) => o.trim().toLowerCase() === value.toLowerCase());
  let byPosition = -1;
  if (/^[A-Za-z]$/.test(value)) byPosition = LETTERS.indexOf(value.toUpperCase());
  else if (/^\d+$/.test(value)) byPosition = Number(value) - numberBase;
  const positionValid = byPosition >= 0 && byPosition < options.length;
  // "2" with options [2, 3, 4] is both the label of option 1 and the position of option 2: never guess.
  if (byLabel !== -1 && positionValid && byLabel !== byPosition) {
    return `answer "${value}" is ambiguous (it is an option's text and another option's ${/^\d+$/.test(value) ? 'number' : 'letter'}); write the option's letter or full text`;
  }
  if (byLabel !== -1) return byLabel;
  if (positionValid) return byPosition;
  if (byPosition !== -1) return `answer "${value}" refers to a missing option`;
  return `answer "${value}" does not match any option`;
}

type QuestionKind = { selection: ChoiceSelection; display: ChoiceDisplay };

/** null = not specified (inferred from the answers); 'invalid' = unrecognized value. */
function normalizeSelection(raw: unknown): QuestionKind | null | 'invalid' {
  if (raw === undefined || raw === null || raw === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (['multiple', 'multi', 'checkbox', 'checkboxes', 'many', 'multiple_answer', 'multiple-answer', 'multiple_choice', 'multiple-choice'].includes(v)) return { selection: 'multiple', display: 'buttons' };
  if (['dropdown', 'select', 'list'].includes(v)) return { selection: 'single', display: 'dropdown' };
  if (['single', 'radio', 'one', 'mcq', 'single_choice', 'single-choice', 'choice'].includes(v)) return { selection: 'single', display: 'buttons' };
  return 'invalid';
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(v)) return true;
    if (['false', 'no', 'n', '0'].includes(v)) return false;
  }
  return fallback;
}

function finishQuestion(
  at: number,
  prompt: string,
  options: string[],
  answers: unknown[],
  numberBase: 0 | 1,
  typeRaw: unknown,
  required: boolean,
  shuffle: boolean,
  errors: ImportIssue[]
): ImportedQuestion | null {
  const before = errors.length;
  if (!prompt.trim()) errors.push({ at, message: 'the question text is empty' });
  const opts = options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (opts.length < 2) errors.push({ at, message: 'a question needs at least two options' });
  if (opts.length > IMPORT_LIMITS.maxOptions) errors.push({ at, message: `a question can have at most ${IMPORT_LIMITS.maxOptions} options` });
  const correct: number[] = [];
  for (const a of answers) {
    const r = resolveAnswer(a, opts, numberBase, numberBase === 1);
    if (typeof r === 'string') errors.push({ at, message: r });
    else if (!correct.includes(r)) correct.push(r);
  }
  const mode = normalizeSelection(typeRaw);
  if (mode === 'invalid') errors.push({ at, message: `unknown question type "${String(typeRaw)}" (use single, multiple or dropdown)` });
  const kind: QuestionKind = mode && mode !== 'invalid' ? mode : { selection: correct.length > 1 ? 'multiple' : 'single', display: 'buttons' };
  if (kind.selection === 'single' && correct.length > 1) errors.push({ at, message: 'a single-choice question has more than one correct answer (set type to multiple)' });
  if (errors.length > before) return null;
  return { prompt: prompt.trim(), options: opts, correct: correct.sort((a, b) => a - b), selection: kind.selection, display: kind.display, required, shuffle };
}

// -----------------------------------------------------------------------------
// JSON / JavaScript data
// -----------------------------------------------------------------------------

/**
 * Converts a JavaScript data literal (single quotes, unquoted keys, trailing commas,
 * comments) into JSON text. Only data syntax is accepted; anything else (function
 * calls, variables) leaves invalid JSON and is reported as a parse error.
 */
export function jsLiteralToJson(source: string): string {
  let src = source.trim();
  // Leading comments (file headers) come before the export statement.
  for (;;) {
    if (src.startsWith('//')) src = src.slice(src.indexOf('\n') === -1 ? src.length : src.indexOf('\n') + 1).trimStart();
    else if (src.startsWith('/*')) src = src.slice(src.indexOf('*/') === -1 ? src.length : src.indexOf('*/') + 2).trimStart();
    else break;
  }
  src = src.replace(/^(export\s+default|module\.exports\s*=|exports\.\w+\s*=|(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=)\s*/, '');
  src = src.replace(/;\s*(export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*)?$/, '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      i = i === -1 ? src.length : i + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      let str = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const next = src[j + 1];
          // \' and \` are not JSON escapes; every other escape (including \") is kept as is.
          str += next === "'" || next === '`' ? next : `\\${next}`;
          j += 2;
          continue;
        }
        if (ch === '`' && src[j] === '$' && src[j + 1] === '{') throw new Error('template expressions are not allowed in data files');
        str += src[j] === '"' ? '\\"' : src[j] === '\n' ? '\\n' : src[j];
        j++;
      }
      out += `"${str}"`;
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      out += src[k] === ':' && !['true', 'false', 'null'].includes(word) ? `"${word}"` : word;
      i = j;
      continue;
    }
    if (ch === ',') {
      let k = i + 1;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === ']' || src[k] === '}') {
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

function parseJsonQuestions(text: string): { questions: ImportedQuestion[]; errors: ImportIssue[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    try {
      data = JSON.parse(jsLiteralToJson(text));
    } catch (e) {
      return { questions: [], errors: [{ at: null, message: `The file is not valid JSON or a JavaScript data literal (${e instanceof Error ? e.message : 'parse error'}).` }] };
    }
  }
  const list = Array.isArray(data) ? data : typeof data === 'object' && data !== null && Array.isArray((data as { questions?: unknown }).questions) ? (data as { questions: unknown[] }).questions : null;
  if (!list) return { questions: [], errors: [{ at: null, message: 'Expected an array of questions or an object with a "questions" array.' }] };

  const questions: ImportedQuestion[] = [];
  const errors: ImportIssue[] = [];
  list.forEach((raw, i) => {
    const at = i + 1;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push({ at, message: 'each question must be an object' });
      return;
    }
    const q = raw as Record<string, unknown>;
    const prompt = q.question ?? q.text ?? q.prompt ?? q.title;
    const optionsRaw = q.options ?? q.choices;
    if (typeof prompt !== 'string') {
      errors.push({ at, message: 'missing "question" text' });
      return;
    }
    const typeRaw = q.type ?? q.selection;
    const typeStr = String(typeRaw).toLowerCase();
    
    if (typeStr === 'number' || typeStr === 'slider') {
      const min = typeof q.min === 'number' ? q.min : null;
      const max = typeof q.max === 'number' ? q.max : null;
      const step = typeof q.step === 'number' ? q.step : null;
      const required = q.required === undefined ? true : Boolean(q.required);
      
      if (typeStr === 'slider' || typeof q.step === 'number' || (min !== null && max !== null)) {
        questions.push({
          element_type: 'SLIDER_RATING',
          prompt: prompt.trim(),
          required,
          min: min ?? 0,
          max: max ?? 100,
          step: step ?? 1,
          options: [],
          correct: [],
          selection: 'single',
          display: 'slider' as any,
          shuffle: false
        });
      } else {
        questions.push({
          element_type: 'TEXT_INPUT',
          prompt: prompt.trim(),
          required,
          min: min ?? undefined,
          max: max ?? undefined,
          options: [],
          correct: [],
          selection: 'single',
          display: 'buttons' as any,
          shuffle: false
        });
      }
      return;
    } else if (typeStr === 'text') {
      questions.push({
        element_type: 'TEXT_INPUT',
        prompt: prompt.trim(),
        required: q.required === undefined ? true : Boolean(q.required),
        options: [],
        correct: [],
        selection: 'single',
        display: 'buttons' as any,
        shuffle: false
      });
      return;
    }

    if (!Array.isArray(optionsRaw)) {
      errors.push({ at, message: 'missing "options" array' });
      return;
    }
    const options: string[] = [];
    const answers: unknown[] = [];
    let optionError = false;
    optionsRaw.forEach((o, oi) => {
      if (typeof o === 'string' || typeof o === 'number') options.push(String(o));
      else if (typeof o === 'object' && o !== null && typeof ((o as Record<string, unknown>).label ?? (o as Record<string, unknown>).text) === 'string') {
        const obj = o as Record<string, unknown>;
        options.push(String(obj.label ?? obj.text));
        if (obj.correct === true || obj.isCorrect === true) answers.push(oi);
      } else optionError = true;
    });
    if (optionError) {
      errors.push({ at, message: 'options must be strings or objects with a "label"' });
      return;
    }
    const answerRaw = q.answer ?? q.answers ?? q.correct ?? q.correctAnswer ?? q.correctAnswers ?? q.answerIndex;
    if (answerRaw !== undefined && answerRaw !== null && answers.length === 0) {
      for (const a of Array.isArray(answerRaw) ? answerRaw : [answerRaw]) answers.push(a);
    }
    const parsed = finishQuestion(at, prompt, options, answers, 0, q.type ?? q.selection, parseBool(q.required, true), parseBool(q.shuffle ?? q.shuffleOptions, false), errors);
    if (parsed) questions.push(parsed);
  });
  return { questions, errors };
}

// -----------------------------------------------------------------------------
// CSV
// -----------------------------------------------------------------------------

/** RFC 4180 parser (quoted fields, escaped quotes, newlines inside quotes); also accepts ';' as separator. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function parseCsvQuestions(text: string): { questions: ImportedQuestion[]; errors: ImportIssue[] } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { questions: [], errors: [{ at: null, message: 'The CSV needs a header row and at least one question row.' }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const qCol = col('question', 'text', 'prompt', 'title');
  if (qCol === -1) return { questions: [], errors: [{ at: 1, message: 'The header needs a "question" column.' }] };
  const answerCol = col('answer', 'answers', 'correct', 'correct answer', 'correct answers');
  const typeCol = col('type', 'selection');
  const requiredCol = col('required');
  const shuffleCol = col('shuffle');
  const optionsCol = col('options', 'choices');
  // option1, option 2, opt3, choice4 ... or single-letter columns A, B, C...
  const optionCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^(option|opt|choice)\s*\d+$/.test(h) || /^[a-z]$/.test(h))
    .map(({ i }) => i);
  if (optionsCol === -1 && optionCols.length === 0) {
    return { questions: [], errors: [{ at: 1, message: 'The header needs option columns (option1, option2, … or A, B, C, …) or an "options" column separated by |.' }] };
  }

  const questions: ImportedQuestion[] = [];
  const errors: ImportIssue[] = [];
  rows.slice(1).forEach((r, i) => {
    const at = i + 2;
    const cell = (c: number) => (c === -1 ? '' : (r[c] ?? '').trim());
    const options = optionsCol !== -1 ? cell(optionsCol).split('|') : optionCols.map(cell);
    const answers = cell(answerCol)
      .split(/[|;]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const parsed = finishQuestion(at, cell(qCol), options, answers, 1, cell(typeCol), parseBool(cell(requiredCol), true), parseBool(cell(shuffleCol), false), errors);
    if (parsed) questions.push(parsed);
  });
  return { questions, errors };
}

// -----------------------------------------------------------------------------
// Aiken
// -----------------------------------------------------------------------------

function parseAikenQuestions(text: string): { questions: ImportedQuestion[]; errors: ImportIssue[] } {
  const questions: ImportedQuestion[] = [];
  const errors: ImportIssue[] = [];
  const lines = text.split(/\r?\n/);
  let prompt: string[] = [];
  let options: string[] = [];
  let count = 0;
  const optionRe = /^([A-Za-z])[.)]\s+(.*)$/;

  const reset = () => {
    prompt = [];
    options = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const answer = /^ANSWER\s*:\s*(.+)$/i.exec(line);
    if (answer) {
      count += 1;
      const letters = answer[1].split(/[\s,;]+/).filter((x) => x.length > 0);
      const parsed = finishQuestion(count, prompt.join(' '), options, letters, 1, letters.length > 1 ? 'multiple' : undefined, true, false, errors);
      if (parsed) questions.push(parsed);
      reset();
      continue;
    }
    const opt = optionRe.exec(line);
    if (opt && prompt.length > 0) {
      const expected = LETTERS[options.length];
      if (opt[1].toUpperCase() !== expected) {
        errors.push({ at: count + 1, message: `option "${opt[1]}" is out of order (expected ${expected})` });
      }
      options.push(opt[2]);
      continue;
    }
    if (options.length > 0) {
      // A new question started without an ANSWER line for the previous one.
      count += 1;
      errors.push({ at: count, message: 'missing "ANSWER:" line' });
      reset();
    }
    prompt.push(line);
  }
  if (prompt.length > 0 || options.length > 0) {
    count += 1;
    errors.push({ at: count, message: 'missing "ANSWER:" line' });
  }
  return { questions, errors };
}

// -----------------------------------------------------------------------------
// Conversion to trials
// -----------------------------------------------------------------------------

export interface QuestionTrialOptions {
  advanceMode: Extract<AdvanceMode, 'response' | 'manual'>;
  condition: string;
  namePrefix: string;
  /** Number used in the first trial's name, e.g. 4 -> "Question 4". */
  startNumber?: number;
}

/** One trial per question, each holding a single multiple-choice element. */
export function questionsToTrials(questions: ImportedQuestion[], opts: QuestionTrialOptions): Trial[] {
  return questions.map((q, i) => {
    const el = createElement('MULTIPLE_CHOICE') as MultipleChoiceElement;
    el.required = q.required;
    el.config = {
      ...el.config,
      prompt: q.prompt,
      selection: q.selection,
      display: q.selection === 'single' ? q.display : 'buttons',
      shuffleOptions: q.shuffle,
      options: q.options.map((label) => ({ id: createId(), label })),
    };
    el.scoring = { enabled: q.correct.length > 0, correctOptionIds: q.correct.map((ci) => el.config.options[ci].id) };
    const trial = createTrial(`${opts.namePrefix} ${(opts.startNumber ?? 1) + i}`);
    return { ...trial, advanceMode: opts.advanceMode, condition: opts.condition, elements: [el] };
  });
}
