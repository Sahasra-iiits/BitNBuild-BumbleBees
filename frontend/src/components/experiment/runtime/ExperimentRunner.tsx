"use client";
// ==============================================================================
// Experiment runtime — used unchanged by the researcher preview and participants
// ==============================================================================
//
// Trial lifecycle (one TrialScreen instance per trial, keyed by position):
//
//   PREPARING  images decode, content hidden
//      │  requestAnimationFrame: content revealed, onset = performance.now()
//   RUNNING    listeners + timer active, responses recorded with RT from onset
//      │  first of: all required answered | Submit | Continue | timer
//   ENDED      `endedRef` set synchronously, record emitted exactly once
//
// Because each trial is its own component instance, its key listener, timer and
// local state are torn down when the next trial mounts, so nothing from trial A
// can affect trial B. The synchronous `endedRef` guard makes a response and a
// timeout that fire in the same frame resolve deterministically: whichever
// callback runs first ends the trial; the other is ignored. Escape and Enter
// never end a trial unless configured as response keys.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  coerceResponseValue,
  getResponseElements,
  isDeferredResponseElement,
  matchResponseKey,
  requiredResponsesSatisfied,
  shouldAdvanceAfterInstantResponse,
  trialHasTimer,
  trialUsesSubmit,
  type AdvanceReason,
  type ElementResponse,
  type ExperimentDefinition,
  type ExperimentElement,
  type KeyboardPressElement,
  type ResponseElement,
  type SliderRatingElement,
  type TextInputElement,
  type Trial,
  type TrialResponsePayload,
} from '@/shared/experiment';
import { mediaSrc, type AssetCache } from '@/lib/experiment/asset-cache';
import { AudioStimulus, FixationStimulus, ImageStimulus, TextStimulus } from './stimuli';
import { ChoiceInput, KeyboardPrompt, SliderInput, TextAnswerInput, YesNoInput } from './responses';

export interface TrialRecord {
  trial: Trial;
  /** Zero-based presentation position (the event's trialSequence). */
  position: number;
  onsetEpochMs: number;
  endEpochMs: number;
  /** RT of the response that ended the trial; null for timeouts and display-only trials. */
  reactionTimeMs: number | null;
  payload: TrialResponsePayload;
}

export interface ExperimentRunnerProps {
  definition: ExperimentDefinition;
  /** Presentation order as indexes into definition.trials. */
  order: number[];
  startPosition?: number;
  assets: AssetCache;
  onTrialComplete: (record: TrialRecord) => void;
  onFinished: () => void;
  /** Researcher-only overlay; never rendered for participants. */
  Overlay?: React.ComponentType<RunnerOverlayProps>;
}

export interface RunnerOverlayProps {
  position: number;
  total: number;
  trial: Trial;
  /** Advances without recording the current trial (preview only). */
  onSkip: () => void;
}

export default function ExperimentRunner({ definition, order, startPosition = 0, assets, onTrialComplete, onFinished, Overlay }: ExperimentRunnerProps) {
  const [position, setPosition] = useState(startPosition);
  const positionRef = useRef(startPosition);
  const finishedRef = useRef(false);
  const callbacks = useRef({ onTrialComplete, onFinished });
  useEffect(() => {
    callbacks.current = { onTrialComplete, onFinished };
  }, [onTrialComplete, onFinished]);

  const advanceFrom = useCallback(
    (from: number) => {
      // A late callback from an earlier trial must never move the experiment.
      if (from !== positionRef.current || finishedRef.current) return;
      const next = from + 1;
      if (next >= order.length) {
        finishedRef.current = true;
        callbacks.current.onFinished();
        return;
      }
      positionRef.current = next;
      setPosition(next);
    },
    [order.length]
  );

  const handleTrialEnd = useCallback(
    (record: TrialRecord) => {
      if (record.position !== positionRef.current || finishedRef.current) return;
      callbacks.current.onTrialComplete(record);
      advanceFrom(record.position);
    },
    [advanceFrom]
  );

  const skip = useCallback(() => advanceFrom(positionRef.current), [advanceFrom]);

  if (position >= order.length) return null;
  const trial = definition.trials[order[position]];

  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-900 overflow-hidden">
      <TrialScreen key={`${position}:${trial.id}`} trial={trial} position={position} total={order.length} assets={assets} onEnd={handleTrialEnd} />
      {Overlay && <Overlay position={position} total={order.length} trial={trial} onSkip={skip} />}
    </div>
  );
}

// =============================================================================
// Single trial
// =============================================================================

interface DeferredDraft {
  slider?: number;
  touched?: boolean;
  text?: string;
  changedAt?: number;
}

function TrialScreen({
  trial,
  position,
  total,
  assets,
  onEnd,
}: {
  trial: Trial;
  position: number;
  total: number;
  assets: AssetCache;
  onEnd: (record: TrialRecord) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onsetRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const responsesRef = useRef(new Map<string, ElementResponse>());
  const draftsRef = useRef<Record<string, DeferredDraft>>({});
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const [running, setRunning] = useState(false);
  const [responses, setResponses] = useState<ReadonlyMap<string, ElementResponse>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, DeferredDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const responseElements = getResponseElements(trial);
  const usesSubmit = trialUsesSubmit(trial);

  // PREPARING -> RUNNING: wait until images are decoded, then reveal the content and
  // take the onset timestamp in the same animation frame.
  useLayoutEffect(() => {
    let cancelled = false;
    let frame = 0;
    const imageSrcs = trial.elements
      .filter((el) => el.type === 'IMAGE_VISUAL')
      .map((el) => (el.type === 'IMAGE_VISUAL' ? mediaSrc(el.config, assets) : null))
      .filter((s): s is string => !!s);
    Promise.all(
      imageSrcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      })
    ).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.style.visibility = 'visible';
          containerRef.current.focus({ preventScroll: true });
        }
        onsetRef.current = performance.now();
        setRunning(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [trial, assets]);

  const emit = useCallback(
    (reason: AdvanceReason, reactionTimeMs: number | null) => {
      const onset = onsetRef.current;
      if (endedRef.current || onset === null) return;
      endedRef.current = true;
      const end = performance.now();
      onEndRef.current({
        trial,
        position,
        onsetEpochMs: performance.timeOrigin + onset,
        endEpochMs: performance.timeOrigin + end,
        // Display-only trials have no reaction time; their duration is end - onset.
        reactionTimeMs: responseElements.length > 0 ? reactionTimeMs : null,
        payload: { advanceReason: reason, elements: Array.from(responsesRef.current.values()) },
      });
    },
    [trial, position, responseElements.length]
  );

  const store = useCallback((el: ResponseElement, value: ElementResponse['value'], display: string, rtMs: number) => {
    responsesRef.current.set(el.id, { elementId: el.id, type: el.type, value, display, rtMs });
    setResponses(new Map(responsesRef.current));
  }, []);

  /** Keys, choices and clicks: recorded immediately; may end the trial. */
  const respondInstant = useCallback(
    (el: ResponseElement, raw: unknown) => {
      const onset = onsetRef.current;
      if (endedRef.current || onset === null) return;
      // The first key press counts (standard for RT tasks); choices can be changed until the trial ends.
      if (el.type === 'KEYBOARD_PRESS' && responsesRef.current.has(el.id)) return;
      const coerced = coerceResponseValue(el, raw);
      if (!coerced.ok) return;
      const rt = performance.now() - onset;
      store(el, coerced.value, coerced.display, rt);
      if (shouldAdvanceAfterInstantResponse(trial, new Set(responsesRef.current.keys()))) emit('response', rt);
    },
    [trial, emit, store]
  );

  /**
   * Commits slider/text drafts. In strict mode (Submit/Continue) invalid or missing
   * required answers produce errors and block; on timeout only valid answers are kept.
   */
  const commitDeferred = useCallback(
    (strict: boolean): boolean => {
      const onset = onsetRef.current ?? performance.now();
      const nextErrors: Record<string, string> = {};
      for (const el of trial.elements) {
        if (!isDeferredResponseElement(el) || el.role !== 'RESPONSE') continue;
        const draft = draftsRef.current[el.id] ?? {};
        if (el.type === 'SLIDER_RATING') {
          const interacted = !!draft.touched || !el.config.requireInteraction;
          if (!interacted) {
            if (el.required) nextErrors[el.id] = 'Please move the slider to give your answer.';
            continue;
          }
          const coerced = coerceResponseValue(el, draft.slider ?? el.config.defaultValue);
          if (coerced.ok) store(el, coerced.value, coerced.display, (draft.changedAt ?? performance.now()) - onset);
          else nextErrors[el.id] = coerced.error;
        } else if (el.type === 'TEXT_INPUT') {
          const text = (draft.text ?? '').trim();
          if (!text) {
            if (el.required) nextErrors[el.id] = 'This answer is required.';
            continue;
          }
          const coerced = coerceResponseValue(el, text);
          if (coerced.ok) store(el, coerced.value, coerced.display, (draft.changedAt ?? performance.now()) - onset);
          else nextErrors[el.id] = coerced.error.charAt(0).toUpperCase() + coerced.error.slice(1) + '.';
        }
      }
      if (strict) setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [trial, store]
  );

  const submit = useCallback(
    (reason: 'submit' | 'continue') => {
      const onset = onsetRef.current;
      if (endedRef.current || onset === null) return;
      if (!commitDeferred(true)) return;
      if (!requiredResponsesSatisfied(trial, new Set(responsesRef.current.keys()))) return;
      emit(reason, performance.now() - onset);
    },
    [trial, commitDeferred, emit]
  );

  // Timer (timed / response_or_timeout), measured from onset.
  useEffect(() => {
    if (!running || !trialHasTimer(trial) || onsetRef.current === null) return;
    const remaining = Math.max(0, (trial.durationMs ?? 0) - (performance.now() - onsetRef.current));
    const timer = setTimeout(() => {
      if (endedRef.current) return;
      commitDeferred(false);
      emit('timeout', null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [running, trial, commitDeferred, emit]);

  // Keyboard responses.
  useEffect(() => {
    const keyboards = trial.elements.filter((el): el is KeyboardPressElement => el.type === 'KEYBOARD_PRESS');
    if (!running || keyboards.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (endedRef.current) return;
      const target = e.target as HTMLElement | null;
      // Typing into a text answer or adjusting a slider is not a key response.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      for (const kb of keyboards) {
        const key = matchResponseKey(e, kb.config.allowedKeys);
        if (key) {
          // Stops Space from scrolling and from activating a focused button.
          e.preventDefault();
          respondInstant(kb, key);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [running, trial, respondInstant]);

  const setDraft = useCallback((el: SliderRatingElement | TextInputElement, patch: DeferredDraft) => {
    if (endedRef.current) return;
    draftsRef.current = { ...draftsRef.current, [el.id]: { ...draftsRef.current[el.id], ...patch, changedAt: performance.now() } };
    setDrafts(draftsRef.current);
    setErrors((prev) => {
      if (!(el.id in prev)) return prev;
      const next = { ...prev };
      delete next[el.id];
      return next;
    });
  }, []);

  // Continue is enabled once every required answer has a usable value.
  const answeredNow = new Set(responses.keys());
  for (const el of trial.elements) {
    const d = drafts[el.id];
    if (el.type === 'SLIDER_RATING' && (d?.touched || !el.config.requireInteraction)) answeredNow.add(el.id);
    if (el.type === 'TEXT_INPUT' && (d?.text ?? '').trim().length > 0) answeredNow.add(el.id);
  }
  const canSubmit = running && requiredResponsesSatisfied(trial, answeredNow);
  const mouseElement = responseElements.find((el) => el.type === 'MOUSE_CLICK');

  const renderElement = (el: ExperimentElement) => {
    const disabled = !running;
    switch (el.type) {
      case 'TEXT_INSTRUCTION':
        return <TextStimulus element={el} />;
      case 'FIXATION_CROSS':
        return <FixationStimulus element={el} />;
      case 'IMAGE_VISUAL':
        return <ImageStimulus element={el} src={mediaSrc(el.config, assets)} />;
      case 'AUDIO_SOUND':
        return <AudioStimulus element={el} src={mediaSrc(el.config, assets)} />;
      case 'KEYBOARD_PRESS': {
        const r = responses.get(el.id);
        return <KeyboardPrompt element={el} pressed={typeof r?.value === 'string' ? r.value : null} />;
      }
      case 'MOUSE_CLICK':
        return <p className="text-sm font-medium text-slate-500">{el.config.prompt}</p>;
      case 'MULTIPLE_CHOICE': {
        const r = responses.get(el.id);
        return <ChoiceInput element={el} selected={typeof r?.value === 'string' ? r.value : null} disabled={disabled} onSelect={(id) => respondInstant(el, id)} />;
      }
      case 'YES_NO': {
        const r = responses.get(el.id);
        return <YesNoInput element={el} selected={typeof r?.value === 'boolean' ? r.value : null} disabled={disabled} onSelect={(v) => respondInstant(el, v)} />;
      }
      case 'SLIDER_RATING': {
        const d = drafts[el.id];
        return (
          <SliderInput
            element={el}
            value={d?.slider ?? el.config.defaultValue}
            touched={!!d?.touched}
            disabled={disabled}
            error={errors[el.id] ?? null}
            onChange={(v) => setDraft(el, { slider: v, touched: true })}
          />
        );
      }
      case 'TEXT_INPUT':
        return <TextAnswerInput element={el} value={drafts[el.id]?.text ?? ''} disabled={disabled} error={errors[el.id] ?? null} onChange={(v) => setDraft(el, { text: v })} />;
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="main"
      aria-label={`Trial ${position + 1} of ${total}`}
      style={{ visibility: running ? 'visible' : 'hidden' }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6 md:p-10 overflow-y-auto outline-none"
    >
      {mouseElement && (
        <div
          className="absolute inset-0 cursor-crosshair"
          aria-hidden="true"
          onClick={(e) => respondInstant(mouseElement, { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })}
        />
      )}
      {trial.elements.map((el) => (
        <div
          key={el.id}
          // In "click anywhere" trials, clicks on stimuli must reach the click layer below.
          className={`relative flex flex-col items-center w-full ${mouseElement && el.type !== 'AUDIO_SOUND' ? 'pointer-events-none' : ''}`}
        >
          {renderElement(el)}
        </div>
      ))}
      {(trial.advanceMode === 'manual' || usesSubmit) && (
        <div className="relative pt-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit(trial.advanceMode === 'manual' ? 'continue' : 'submit')}
            className="min-w-40 min-h-12 px-8 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {trial.advanceMode === 'manual' ? 'Continue' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
