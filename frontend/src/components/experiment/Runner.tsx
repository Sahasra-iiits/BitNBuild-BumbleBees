"use client";
// ==============================================================================
// CogniScale — High-Precision Experiment Runner
// ==============================================================================
// ARCHITECTURE:
// 1. Full experiment config preloaded before first trial
// 2. Trial execution is entirely local (no network per-trial)
// 3. Events buffered in EventBuffer, flushed in batches
// 4. performance.now() for high-resolution timing
// 5. React state updates only on trial transitions (not per-tick)

import { useEffect, useRef, useState, useCallback } from 'react';
import { ExperimentVersion, ExperimentTrial, BatchEvent } from '@/lib/types/api';
import { EventBuffer } from '@/lib/api/sessions';
import { v4 as uuidv4 } from 'uuid';

interface RunnerProps {
  sessionId: string;
  version: ExperimentVersion;
  onComplete: () => void;
  isPreview?: boolean;
}

type RunnerState = 'INITIALIZING' | 'RUNNING' | 'BETWEEN_TRIALS' | 'AWAITING_RESPONSE' | 'COMPLETED';

export default function ExperimentRunner({ sessionId, version, onComplete, isPreview = false }: RunnerProps) {
  const [trialIndex, setTrialIndex] = useState(0);
  const [runnerState, setRunnerState] = useState<RunnerState>('INITIALIZING');
  const [previewDebug, setPreviewDebug] = useState<{ rt?: number; state?: string } | null>(null);

  // Refs for high-precision mutable state (no re-renders on updates)
  const trialStartTimeRef = useRef<number>(0);
  const eventBufferRef = useRef<EventBuffer | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientSequenceRef = useRef(0);

  const trials = version.trials || [];
  const currentTrial = trials[trialIndex] as ExperimentTrial | undefined;

  // Initialize event buffer
  useEffect(() => {
    if (!isPreview) {
      eventBufferRef.current = new EventBuffer(sessionId);
    }
    setRunnerState('RUNNING');

    return () => {
      eventBufferRef.current?.destroy();
    };
  }, [sessionId, isPreview]);

  const recordEvent = useCallback((trial: ExperimentTrial, response: unknown, isTimeout = false) => {
    if (isPreview) return; // Never contaminate real data in preview

    const now = performance.now();
    const rt = now - trialStartTimeRef.current;
    
    const event: BatchEvent = {
      eventId: uuidv4(),
      trialId: trial.id,
      trialSequence: trial.sequenceOrder,
      stimulusDisplayTimestamp: Math.floor(performance.timeOrigin + trialStartTimeRef.current),
      responseTimestamp: Math.floor(performance.timeOrigin + now),
      reactionTimeMs: rt,
      response: typeof response === 'object' ? (response as Record<string, unknown>) : { value: response },
      timeout: isTimeout,
      clientEventSequence: clientSequenceRef.current++,
    };

    eventBufferRef.current?.push(event);

    if (isPreview) {
      setPreviewDebug({ rt: Math.round(rt), state: isTimeout ? 'TIMEOUT' : 'RESPONDED' });
    }
  }, [isPreview]);

  const advanceTrial = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (trialIndex < trials.length - 1) {
      setTrialIndex(prev => prev + 1);
    } else {
      setRunnerState('COMPLETED');
      // Final flush before completion
      await eventBufferRef.current?.flushAll();
      onComplete();
    }
  }, [trialIndex, trials.length, onComplete]);

  // Set up trial timer and keyboard listener when trial changes
  useEffect(() => {
    if (!currentTrial || runnerState !== 'RUNNING') return;

    // Record trial start with high-resolution timestamp
    trialStartTimeRef.current = performance.now();

    // Check if this trial requires keyboard response
    const hasKeyboardInput = currentTrial.elements?.some(el => el.elementType === 'KEYBOARD_INPUT');
    const allowedKeys: string[] = hasKeyboardInput
      ? ((currentTrial.elements?.find(el => el.elementType === 'KEYBOARD_INPUT')?.configuration?.allowedKeys as string[]) || [])
      : [];

    const handleKeydown = (e: KeyboardEvent) => {
      if (!hasKeyboardInput) return;
      if (allowedKeys.length > 0 && !allowedKeys.includes(e.key.toLowerCase())) return;

      recordEvent(currentTrial, { key: e.key.toLowerCase() });
      advanceTrial();
    };

    if (hasKeyboardInput) {
      window.addEventListener('keydown', handleKeydown);
    }

    // Auto-advance after durationMs if no keyboard response expected
    if (currentTrial.durationMs && !hasKeyboardInput) {
      timeoutRef.current = setTimeout(() => {
        recordEvent(currentTrial, null, true);
        advanceTrial();
      }, currentTrial.durationMs);
    }

    // Response timeout (even with keyboard — forces advance)
    if (currentTrial.timeoutMs && hasKeyboardInput) {
      timeoutRef.current = setTimeout(() => {
        recordEvent(currentTrial, null, true);
        advanceTrial();
      }, currentTrial.timeoutMs);
    }

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [trialIndex, currentTrial, runnerState, recordEvent, advanceTrial]);

  if (runnerState === 'INITIALIZING' || !currentTrial) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-slate-400 text-lg">Loading experiment...</div>
      </div>
    );
  }

  if (runnerState === 'COMPLETED') {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-slate-600 text-lg">Finishing up...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white text-slate-900 select-none overflow-hidden relative">
      {/* Researcher-only debug overlay — never shown to participants */}
      {isPreview && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-green-400 text-xs font-mono p-3 rounded-lg z-50 space-y-1">
          <div className="font-bold text-white">PREVIEW MODE</div>
          <div>Trial: {trialIndex + 1} / {trials.length}</div>
          <div>Type: {currentTrial.trialType}</div>
          {previewDebug?.rt && <div>Last RT: {previewDebug.rt}ms</div>}
          <div className="mt-2 text-yellow-300">No data is recorded in preview.</div>
        </div>
      )}

      <div className="max-w-4xl w-full text-center space-y-8 p-8">
        <TrialRenderer trial={currentTrial} />
      </div>
    </div>
  );
}

function TrialRenderer({ trial }: { trial: ExperimentTrial }) {
  if (!trial.elements || trial.elements.length === 0) {
    // Fallback for trials without explicit elements
    if (trial.trialType === 'FIXATION') {
      return <div className="text-6xl font-thin text-slate-700">+</div>;
    }
    return null;
  }

  return (
    <>
      {trial.elements
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map(el => <ElementRenderer key={el.id} element={el} />)}
    </>
  );
}

function ElementRenderer({ element }: { element: { id: string; elementType: string; configuration: Record<string, unknown>; sequenceOrder: number } }) {
  const cfg = (element as any).configuration || {};
  const type = (element as any).elementType;

  switch (type) {
    case 'TEXT':
      return <p className="text-3xl font-medium text-slate-800 max-w-2xl mx-auto leading-relaxed">{cfg.text}</p>;
    case 'FIXATION':
      return <div className="text-7xl font-light text-slate-600">+</div>;
    case 'IMAGE':
      return (
        <img
          src={cfg.src}
          alt={cfg.alt || 'stimulus'}
          className="mx-auto max-h-96 object-contain rounded-lg"
          style={{ imageRendering: 'crisp-edges' }}
        />
      );
    case 'KEYBOARD_INPUT':
      return (
        <div className="text-slate-400 text-base mt-4">
          Press {(cfg.allowedKeys as string[])?.map((k: string) => (
            <kbd key={k} className="mx-1 px-2 py-1 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono">{k.toUpperCase()}</kbd>
          ))}
        </div>
      );
    default:
      return null;
  }
}
