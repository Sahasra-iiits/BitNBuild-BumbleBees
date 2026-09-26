"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Trial, ExperimentElement, ScoringConfig } from '@/lib/experiment/schema';

type RunState = 'LOADING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'ERROR';

function PreviewImage({ element }: { element: any }) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let activeUrl = '';
    
    async function load() {
      if (element.config.url.startsWith('asset://')) {
        const { AssetStore } = await import('@/lib/experiment/assets');
        const resolved = await AssetStore.getAssetUrl(element.config.url);
        activeUrl = resolved;
        setSrc(resolved);
      } else {
        setSrc(element.config.url);
      }
    }
    load();

    return () => {
      if (activeUrl && activeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [element.config.url]);

  if (!src) return <div className="w-64 h-64 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400 mb-8">Loading...</div>;

  return (
    <img 
      src={src} 
      alt={element.config.altText || ''} 
      className="max-w-2xl max-h-[60vh] object-contain mb-8 rounded-lg shadow-sm"
      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" fill="%23f1f5f9"><rect width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="%2394a3b8">Image Failed to Load</text></svg>'; }}
    />
  );
}

function PreviewAudio({ element }: { element: any }) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let activeUrl = '';
    
    async function load() {
      if (element.config.url.startsWith('asset://')) {
        const { AssetStore } = await import('@/lib/experiment/assets');
        const resolved = await AssetStore.getAssetUrl(element.config.url);
        activeUrl = resolved;
        setSrc(resolved);
      } else {
        setSrc(element.config.url);
      }
    }
    load();

    return () => {
      if (activeUrl && activeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [element.config.url]);

  if (!src) return <div className="mb-8 p-4 bg-slate-100 text-slate-400 rounded animate-pulse">Loading audio...</div>;

  return (
    <audio 
      src={src} 
      autoPlay={element.config.autoplay} 
      controls 
      className="mb-8"
    />
  );
}

export default function PreviewPage() {
  const router = useRouter();
  const params = useParams();
  
  const [runState, setRunState] = useState<RunState>('LOADING');
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  
  // Data collection
  const [results, setResults] = useState<any[]>([]);
  const [localResponses, setLocalResponses] = useState<Record<string, any>>({});
  
  // Timing
  const trialStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bitnbuild:experiment:${params.id}`);
      if (!saved) throw new Error("No experiment draft found.");
      
      const parsed = JSON.parse(saved);
      if (!parsed.trials || parsed.trials.length === 0) {
        throw new Error("Experiment has no trials.");
      }
      
      setTrials(parsed.trials);
      setRunState('READY');
    } catch (err) {
      console.error(err);
      setRunState('ERROR');
    }
  }, [params.id]);

  const advanceTrial = useCallback((reason: string, extraData: any = {}) => {
    // Record baseline timing for the advancement
    const rt = performance.now() - trialStartTimeRef.current;
    
    // Clear any active timers for this trial
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setResults(prev => [...prev, {
      trialId: trials[currentTrialIndex].id,
      trialName: trials[currentTrialIndex].name,
      advanceReason: reason,
      reactionTimeMs: rt,
      ...localResponses,
      ...extraData
    }]);

    setLocalResponses({});

    if (currentTrialIndex < trials.length - 1) {
      setCurrentTrialIndex(prev => prev + 1);
    } else {
      setRunState('COMPLETED');
    }
  }, [currentTrialIndex, trials]);

  const handleElementResponse = useCallback((elementId: string, value: any, scoring?: ScoringConfig) => {
    const trial = trials[currentTrialIndex];
    let isCorrect: boolean | undefined = undefined;

    if (scoring && scoring.enabled) {
      isCorrect = (scoring.correctAnswer === value);
    }
    
    setLocalResponses(prev => ({ ...prev, [elementId]: value }));

    // In a real system, we might accumulate multiple responses if advanceMode requires it.
    // For now, if the trial advanceMode expects a response, we advance immediately upon receiving one.
    if (trial.advanceMode === 'response' || trial.advanceMode === 'response_or_timeout') {
      advanceTrial('participant_response', { elementId, response: value, isCorrect });
    } else {
      // Just record it silently without advancing
      setResults(prev => {
        const last = prev[prev.length - 1];
        if (last && last.trialId === trial.id) {
           return prev; // naive anti-duplicate, real implementation would be more robust
        }
        return [...prev, { trialId: trial.id, elementId, response: value, isCorrect, rt: performance.now() - trialStartTimeRef.current }];
      });
    }
  }, [currentTrialIndex, trials, advanceTrial]);

  // Setup Trial Lifecycle
  useEffect(() => {
    if (runState !== 'RUNNING') return;
    
    const trial = trials[currentTrialIndex];
    trialStartTimeRef.current = performance.now();

    // 1. Setup Timeout if applicable
    if ((trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout') && trial.durationMs) {
      timerRef.current = setTimeout(() => {
        advanceTrial('timeout');
      }, trial.durationMs);
    }

    // 2. Setup Keyboard Listener if trial has KEYBOARD_PRESS
    const keyboardElements = trial.elements.filter(e => e.type === 'KEYBOARD_PRESS');
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Only process if we aren't typing in an input (in case we add text inputs later)
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      for (const el of keyboardElements) {
        const config = el.config;
        if (config.allowedKeys.length === 0 || config.allowedKeys.includes(key) || (key === ' ' && config.allowedKeys.includes('space'))) {
          e.preventDefault(); // Prevent scrolling on space
          handleElementResponse(el.id, key === ' ' ? 'space' : key, el.scoring);
          return; // Only process first matching keyboard element to prevent double-firing
        }
      }
    };

    if (keyboardElements.length > 0) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTrialIndex, runState, trials, advanceTrial, handleElementResponse]);


  if (runState === 'LOADING') return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">Loading experiment...</div>;
  if (runState === 'ERROR') return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center flex-col gap-4 text-red-500"><span>Failed to load experiment.</span><button onClick={() => router.back()} className="px-4 py-2 bg-slate-900 text-white rounded">Go Back</button></div>;

  if (runState === 'READY') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 p-4">
        <h1 className="text-3xl font-bold mb-4">Preview Ready</h1>
        <p className="text-slate-600 mb-8 max-w-md text-center">
          This preview uses the exact runtime engine that participants will see. Reaction times and responses will be recorded.
        </p>
        <div className="flex gap-4">
          <button onClick={() => router.back()} className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300">Back to Builder</button>
          <button onClick={() => setRunState('RUNNING')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Preview</button>
        </div>
      </div>
    );
  }

  if (runState === 'COMPLETED') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 p-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Experiment Complete</h1>
        
        <div className="bg-white border rounded-xl shadow-sm w-full max-w-2xl mb-8 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="bg-slate-100 px-4 py-3 border-b font-semibold text-slate-700">Collected Trial Data</div>
          <div className="p-4 bg-slate-900 text-green-400 font-mono text-xs overflow-y-auto flex-1 whitespace-pre-wrap break-all">
            {JSON.stringify(results, null, 2)}
          </div>
        </div>

        <button onClick={() => router.back()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm">
          Return to Builder
        </button>
      </div>
    );
  }

  const trial = trials[currentTrialIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden selection:bg-transparent">
      {/* Dev HUD - Never show in real participant runner */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
        <button onClick={() => router.back()} className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-md text-xs hover:bg-red-200 shadow-sm">
          Exit Preview
        </button>
      </div>
      <div className="absolute top-4 right-4 text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border">
        Trial {currentTrialIndex + 1} / {trials.length} | {trial.advanceMode}
      </div>
      
      {/* Experiment Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-default">
        {trial.elements.map(el => {
          switch (el.type) {
            case 'FIXATION_CROSS':
              return (
                <div key={el.id} className="text-6xl font-light text-slate-800 mb-8">
                  {el.config.style === 'dot' ? '•' : el.config.style === 'circle' ? '○' : '+'}
                </div>
              );
            case 'TEXT_INSTRUCTION':
              return (
                <h2 key={el.id} className="text-4xl font-medium text-slate-900 max-w-3xl leading-relaxed mb-8 whitespace-pre-wrap">
                  {el.config.text}
                </h2>
              );
            case 'IMAGE_VISUAL':
              return <PreviewImage key={el.id} element={el} />;
            case 'AUDIO_SOUND':
              return <PreviewAudio key={el.id} element={el} />;
            case 'MULTIPLE_CHOICE':
              return (
                <div key={el.id} className="space-y-4 mb-8 w-full max-w-md">
                   {el.config.options.map((opt: any) => {
                     const isSelected = localResponses[el.id] === opt.id;
                     return (
                       <button 
                         key={opt.id}
                         onClick={() => handleElementResponse(el.id, opt.id, el.scoring)} 
                         className={`block w-full p-4 border-2 rounded-xl text-lg transition-all font-medium shadow-sm ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500 ring-offset-2' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
                       >
                         {opt.label}
                       </button>
                     );
                   })}
                </div>
              );
            case 'SLIDER_RATING':
              return (
                <div key={el.id} className="w-full max-w-lg space-y-6 mb-8">
                  <div className="flex justify-between text-sm font-medium text-slate-500 px-2">
                    <span>{el.config.leftLabel || el.config.min}</span>
                    <span>{el.config.rightLabel || el.config.max}</span>
                  </div>
                  <input 
                    type="range" 
                    min={el.config.min} 
                    max={el.config.max} 
                    step={el.config.step}
                    defaultValue={el.config.defaultValue}
                    onMouseUp={(e) => handleElementResponse(el.id, (e.target as HTMLInputElement).value, el.scoring)}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                  />
                </div>
              );
            case 'MOUSE_CLICK':
              return (
                <div 
                  key={el.id}
                  onClick={(e) => handleElementResponse(el.id, { x: e.clientX, y: e.clientY }, el.scoring)}
                  className="fixed inset-0 z-0 cursor-crosshair flex flex-col justify-end items-center pb-20"
                >
                  <div className="bg-slate-900/10 backdrop-blur-sm px-6 py-3 rounded-full text-slate-600 font-medium animate-pulse text-sm">
                    Click anywhere on the screen to respond
                  </div>
                </div>
              );
            case 'KEYBOARD_PRESS':
              return (
                <div key={el.id} className="mt-8 flex flex-col items-center justify-center relative z-10">
                  <span className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3">Keyboard Response</span>
                  <div className="flex gap-4">
                    {el.config.allowedKeys.length > 0 ? el.config.allowedKeys.map((key: string) => {
                      const isSelected = localResponses[el.id] === (key === 'space' ? 'space' : key);
                      return (
                        <div key={key} className={`w-14 h-14 flex items-center justify-center border-b-4 border-2 rounded-xl text-xl font-mono font-bold uppercase transition-all ${isSelected ? 'border-blue-600 border-b-blue-700 bg-blue-500 text-white scale-95 translate-y-1 shadow-inner' : 'border-slate-200 border-b-slate-300 text-slate-600 bg-white shadow-sm'}`}>
                          {key === 'space' ? '␣' : key}
                        </div>
                      );
                    }) : (
                      <span className="text-sm text-slate-400 italic bg-slate-100 px-4 py-2 rounded-lg">Press any key</span>
                    )}
                  </div>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
      
      {trial.advanceMode === 'manual' && (
        <div className={`absolute bottom-8 left-0 right-0 flex justify-center z-10 transition-all duration-500 ${Object.keys(localResponses).length > 0 || trial.elements.filter(e => e.role === 'RESPONSE').length === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button 
            onClick={() => advanceTrial('manual_continue')}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            Continue 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
          </button>
        </div>
      )}
    </div>
  );
}
