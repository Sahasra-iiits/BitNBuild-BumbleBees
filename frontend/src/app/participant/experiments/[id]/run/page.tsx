"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trial, ScoringConfig } from '@/lib/experiment/schema';
import { AssetStore } from '@/lib/experiment/assets';
import { CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

type RunState = 'LOADING' | 'ERROR' | 'CONSENT' | 'PRELOADING' | 'RUNNING' | 'COMPLETED';

export default function ParticipantRunPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [runState, setRunState] = useState<RunState>('LOADING');
  const [trials, setTrials] = useState<Trial[]>([]);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [localResponses, setLocalResponses] = useState<Record<string, any>>({});
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const trialStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const loadExperiment = async () => {
      try {
        const { publicExperimentsApi } = await import('@/lib/api/experiments');
        const exp = await publicExperimentsApi.get(id);
        setRunState('CONSENT');
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Experiment is unavailable.';
        setErrorMsg(msg);
        setRunState('ERROR');
      }
    };
    loadExperiment();
  }, [id]);

  const startExperiment = async () => {
    setRunState('PRELOADING');
    try {
      const { sessionsApi } = await import('@/lib/api/sessions');
      // 1. Start the session to get the version config
      const sessionData = await sessionsApi.start(id);
      setSessionId(sessionData.id);
      
      const configTrials = sessionData.version.configSnapshot.trials || [];
      setTrials(configTrials);
      
      // 2. Preload assets
      AssetStore.init();
      const urls: Record<string, string> = {};
      for (const t of configTrials) {
        for (const el of t.elements) {
          if (el.type === 'IMAGE_VISUAL' && el.config.url?.startsWith('asset://')) {
            urls[el.config.url] = await AssetStore.getAssetUrl(el.config.url);
          }
          if (el.type === 'AUDIO_SOUND' && el.config.url?.startsWith('asset://')) {
            urls[el.config.url] = await AssetStore.getAssetUrl(el.config.url);
          }
        }
      }
      setAssetUrls(urls);
      
      // 3. Start running
      setRunState('RUNNING');
      setCurrentTrialIndex(0);
      setLocalResponses({});
    } catch (err: any) {
      console.error('Failed to start session', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Experiment is unavailable.';
      setErrorMsg(msg);
      setRunState('ERROR');
    }
  };

  const advanceTrial = useCallback(async (reason: string, responseData?: any) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    let trialResults: any[] = [];
    if (responseData) {
      trialResults.push({
        elementId: responseData.elementId,
        response: responseData.response,
        isCorrect: responseData.isCorrect
      });
    } else {
      Object.entries(localResponses).forEach(([elId, val]) => {
        trialResults.push({ elementId: elId, response: val });
      });
    }

    // Build the batch event for this trial
    const event = {
      eventId: uuidv4(),
      trialId: trials[currentTrialIndex].id || `trial-${currentTrialIndex}`,
      trialSequence: currentTrialIndex,
      reactionTimeMs: performance.now() - trialStartTimeRef.current,
      response: { results: trialResults, reason },
      timeout: reason === 'timeout',
    };

    setLocalResponses({});
    
    // Ingest the event to backend in the background
    if (sessionId) {
      import('@/lib/api/sessions').then(({ sessionsApi }) => {
        sessionsApi.ingestBatch(sessionId, [event]).catch(console.error);
      });
    }

    if (currentTrialIndex < trials.length - 1) {
      setCurrentTrialIndex(prev => prev + 1);
    } else {
      setRunState('COMPLETED');
      if (sessionId) {
        import('@/lib/api/sessions').then(({ sessionsApi }) => {
          sessionsApi.complete(sessionId).catch(console.error);
        });
      }
    }
  }, [currentTrialIndex, trials, localResponses, sessionId]);

  useEffect(() => {
    if (runState !== 'RUNNING') return;

    const trial = trials[currentTrialIndex];
    if (!trial) return;

    trialStartTimeRef.current = performance.now();

    if (trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout') {
      if (trial.durationMs && trial.durationMs > 0) {
        timerRef.current = setTimeout(() => advanceTrial('timeout'), trial.durationMs);
      }
    }

    const keyboardElements = trial.elements.filter(e => e.type === 'KEYBOARD_PRESS');
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      for (const el of keyboardElements) {
        const allowed = (el.config as any).allowedKeys || [];
        if (allowed.length === 0 || allowed.includes(key)) {
          setLocalResponses(prev => ({ ...prev, [el.id]: key }));
          if (trial.advanceMode !== 'timed') {
            advanceTrial('participant_response', { elementId: el.id, response: key });
          }
          break;
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
  }, [currentTrialIndex, runState, trials, advanceTrial]);

  const handleElementResponse = useCallback((elementId: string, value: any, scoring?: ScoringConfig) => {
    const trial = trials[currentTrialIndex];
    let isCorrect: boolean | undefined = undefined;
    if (scoring && scoring.enabled) {
      isCorrect = (scoring.correctAnswer === value);
    }
    setLocalResponses(prev => ({ ...prev, [elementId]: value }));

    if (trial.advanceMode !== 'timed') {
      advanceTrial('participant_response', { elementId, response: value, isCorrect });
    }
  }, [currentTrialIndex, trials, advanceTrial]);

  if (runState === 'LOADING') return <div className="fixed inset-0 bg-white flex items-center justify-center">Loading...</div>;
  if (runState === 'ERROR') return <div className="fixed inset-0 bg-white flex items-center justify-center flex-col gap-4 text-slate-800"><h1 className="text-2xl font-bold">Experiment Error</h1><p className="text-red-600 font-medium">{errorMsg}</p><Link href="/" className="text-blue-600 underline">Return Home</Link></div>;

  if (runState === 'CONSENT') {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border p-8 space-y-6">
          <h1 className="text-2xl font-bold">Participant Consent</h1>
          <div className="prose prose-slate">
            <p>You are invited to participate in a research study.</p>
            <p>Your participation is completely voluntary. You may withdraw at any time without penalty. All data collected will be anonymous.</p>
            <p>The study involves responding to stimuli displayed on your screen.</p>
            <p>By clicking "I Consent", you confirm that you understand and agree to participate.</p>
          </div>
          <div className="pt-6 border-t flex justify-end gap-4">
            <button onClick={() => router.push('/')} className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Decline</button>
            <button onClick={startExperiment} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">I Consent, Start</button>
          </div>
        </div>
      </div>
    );
  }

  if (runState === 'COMPLETED') {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-4 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Thank You!</h1>
        <p className="text-xl text-slate-600 max-w-md">Your responses have been recorded successfully. You may now close this tab.</p>
      </div>
    );
  }

  const trial = trials[currentTrialIndex];
  if (!trial) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center overflow-hidden touch-none select-none">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full max-w-4xl mx-auto">
        {trial.elements.map(el => {
          switch (el.type) {
            case 'TEXT_INSTRUCTION':
              return <div key={el.id} className="text-3xl font-medium text-slate-900 text-center mb-8 whitespace-pre-wrap">{el.config.text}</div>;
            case 'IMAGE_VISUAL':
              return <img key={el.id} src={assetUrls[el.config.url] || el.config.url} alt={el.config.altText} className="max-w-full max-h-[60vh] object-contain mb-8 rounded shadow-sm" />;
            case 'AUDIO_SOUND':
              return <audio key={el.id} src={assetUrls[el.config.url] || el.config.url} autoPlay={el.config.autoplay} controls className="mb-8" />;
            case 'FIXATION_CROSS':
              return <div key={el.id} className="text-8xl font-light text-slate-400 mb-8">{el.config.style || '+'}</div>;
            case 'KEYBOARD_PRESS':
              return null; // Keyboard relies on event listener
            case 'MULTIPLE_CHOICE':
              return (
                <div key={el.id} className="w-full max-w-md space-y-3 mb-8 relative z-10">
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
                <div key={el.id} className="w-full max-w-lg space-y-6 mb-8 relative z-10">
                  <div className="flex justify-between text-sm font-medium text-slate-500 px-2">
                    <span>{el.config.leftLabel || el.config.min}</span>
                    <span>{el.config.rightLabel || el.config.max}</span>
                  </div>
                  <input 
                    type="range" 
                    min={el.config.min} max={el.config.max} step={el.config.step} defaultValue={el.config.defaultValue}
                    onMouseUp={(e) => handleElementResponse(el.id, (e.target as HTMLInputElement).value, el.scoring)}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                  />
                </div>
              );
            case 'TEXT_INPUT':
              return (
                <div key={el.id} className="w-full max-w-md mb-8 relative z-10">
                  {el.config.multiline ? (
                    <textarea 
                      placeholder={el.config.placeholder || ''} value={localResponses[el.id] || ''}
                      onChange={(e) => setLocalResponses(prev => ({ ...prev, [el.id]: e.target.value }))}
                      onBlur={(e) => handleElementResponse(el.id, e.target.value, el.scoring)}
                      className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all min-h-[120px] resize-y shadow-sm bg-white"
                    />
                  ) : (
                    <input 
                      type="text" placeholder={el.config.placeholder || ''} value={localResponses[el.id] || ''}
                      onChange={(e) => setLocalResponses(prev => ({ ...prev, [el.id]: e.target.value }))}
                      onBlur={(e) => handleElementResponse(el.id, e.target.value, el.scoring)}
                      onKeyDown={(e) => e.key === 'Enter' && handleElementResponse(el.id, e.currentTarget.value, el.scoring)}
                      className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm bg-white"
                    />
                  )}
                </div>
              );
            case 'MOUSE_CLICK':
              return (
                <div 
                  key={el.id}
                  className="absolute inset-0 cursor-crosshair z-0"
                  onClick={(e) => handleElementResponse(el.id, { x: e.clientX, y: e.clientY }, el.scoring)}
                />
              );
            default: return null;
          }
        })}
      </div>
      
      {trial.advanceMode === 'manual' && trial.elements.filter(e => e.role === 'RESPONSE').length === 0 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10 animate-fade-in">
          <button 
            onClick={() => advanceTrial('manual_continue')}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            Continue 
          </button>
        </div>
      )}
    </div>
  );
}
