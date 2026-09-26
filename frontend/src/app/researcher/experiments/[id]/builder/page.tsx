"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Play, Copy, Trash2, Settings, Plus, GripVertical, Image as ImageIcon, Volume2, Type, MousePointer2, Keyboard, List, SlidersHorizontal, Crosshair, ArrowUp, ArrowDown } from 'lucide-react';
import { 
  Trial, 
  ExperimentElement, 
  generateId, 
  getDefaultScoring, 
  ScoringConfig,
  AdvanceMode
} from '@/lib/experiment/schema';

// --- CONFIG COMPONENTS ---

function ScoringConfigPanel({ scoring, updateScoring, possibleAnswers, answerLabels }: { scoring: ScoringConfig, updateScoring: (s: ScoringConfig) => void, possibleAnswers: any[], answerLabels?: string[] }) {
  if (!scoring) return null;
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <input type="checkbox" checked={scoring.enabled} onChange={(e) => updateScoring({ ...scoring, enabled: e.target.checked })} className="w-3.5 h-3.5" />
          Track Correctness (Scoring)
        </label>
      </div>
      
      {scoring.enabled && (
        <div className="pl-5 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Correct Answer</label>
            <div className="flex flex-wrap gap-2">
              {possibleAnswers.length === 0 ? (
                <span className="text-xs text-red-500 italic">Please configure the element options first.</span>
              ) : (
                possibleAnswers.map((ans, i) => (
                  <label key={ans} className={`cursor-pointer px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${scoring.correctAnswer === ans ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'}`}>
                    <input type="radio" className="hidden" checked={scoring.correctAnswer === ans} onChange={() => updateScoring({ ...scoring, correctAnswer: ans })} />
                    <span>{answerLabels ? answerLabels[i] : ans}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextInstructionConfig({ element, update }: { element: any, update: (e: any) => void }) {
  return (
    <textarea 
      className="w-full text-sm border border-slate-200 rounded-md p-2 mt-2 outline-none focus:border-blue-500" 
      rows={3} 
      placeholder="Enter instructions..."
      value={element.config.text}
      onChange={(e) => update({ ...element, config: { ...element.config, text: e.target.value } })}
    />
  );
}

function ImageVisualConfig({ element, update }: { element: any, update: (e: any) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const { AssetStore } = await import('@/lib/experiment/assets');
        const assetUri = await AssetStore.saveAsset(file);
        update({ ...element, config: { ...element.config, url: assetUri } });
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-3">
        <input 
          type="text" 
          className="flex-1 text-sm border border-slate-200 rounded-md p-2 outline-none focus:border-blue-500 bg-slate-50" 
          placeholder="Image URL or Browse..." 
          value={element.config.url.startsWith('asset://') ? '[Local Uploaded File]' : element.config.url}
          onChange={(e) => update({ ...element, config: { ...element.config, url: e.target.value } })}
        />
        <label className={`px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-200'}`}>
          {uploading ? 'Uploading...' : 'Browse'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <input 
        type="text" 
        className="w-full text-sm border border-slate-200 rounded-md p-2 outline-none focus:border-blue-500" 
        placeholder="Alt text (accessibility)" 
        value={element.config.altText || ''}
        onChange={(e) => update({ ...element, config: { ...element.config, altText: e.target.value } })}
      />
    </div>
  );
}

function AudioSoundConfig({ element, update }: { element: any, update: (e: any) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const { AssetStore } = await import('@/lib/experiment/assets');
        const assetUri = await AssetStore.saveAsset(file);
        update({ ...element, config: { ...element.config, url: assetUri } });
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-3">
        <input 
          type="text" 
          className="flex-1 text-sm border border-slate-200 rounded-md p-2 outline-none focus:border-blue-500 bg-slate-50" 
          placeholder="Audio URL or Browse..." 
          value={element.config.url.startsWith('asset://') ? '[Local Uploaded File]' : element.config.url}
          onChange={(e) => update({ ...element, config: { ...element.config, url: e.target.value } })}
        />
        <label className={`px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-200'}`}>
          {uploading ? 'Uploading...' : 'Browse'}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input 
          type="checkbox" 
          checked={element.config.autoplay}
          onChange={(e) => update({ ...element, config: { ...element.config, autoplay: e.target.checked } })}
        />
        Autoplay on trial start (May require prior interaction due to browser policies)
      </label>
    </div>
  );
}

function FixationCrossConfig({ element, update }: { element: any, update: (e: any) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-sm text-slate-600">Style:</span>
      <select 
        className="text-sm border border-slate-200 rounded-md p-1.5 outline-none focus:border-blue-500"
        value={element.config.style}
        onChange={(e) => update({ ...element, config: { ...element.config, style: e.target.value } })}
      >
        <option value="+">Plus (+)</option>
        <option value="dot">Dot (•)</option>
        <option value="circle">Circle (○)</option>
      </select>
    </div>
  );
}

function KeyboardConfig({ element, update }: { element: any, update: (e: any) => void }) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const key = e.key.toLowerCase();
    if (key !== 'escape' && key !== 'tab' && !element.config.allowedKeys.includes(key)) {
      update({
        ...element,
        config: { ...element.config, allowedKeys: [...element.config.allowedKeys, key === ' ' ? 'space' : key] }
      });
    }
    setIsRecording(false);
  };

  const removeKey = (k: string) => {
    update({
      ...element,
      config: { ...element.config, allowedKeys: element.config.allowedKeys.filter((x: string) => x !== k) }
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Allowed Keys</label>
        <div className="flex flex-wrap gap-2 items-center">
          {element.config.allowedKeys.map((k: string) => (
            <span key={k} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-sm font-medium flex items-center gap-1 uppercase shadow-sm">
              {k}
              <button onClick={() => removeKey(k)} className="text-slate-400 hover:text-red-500 ml-1 transition-colors">&times;</button>
            </span>
          ))}
          <button 
            onClick={() => setIsRecording(true)}
            onKeyDown={isRecording ? handleKeyDown : undefined}
            onBlur={() => setIsRecording(false)}
            autoFocus={isRecording}
            className={`px-3 py-1 border border-dashed rounded-md text-sm font-medium transition-all ${isRecording ? 'border-blue-500 bg-blue-50 text-blue-700 outline-none ring-2 ring-blue-500/20' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
          >
            {isRecording ? 'Listening... (Press a key)' : '+ Add Key'}
          </button>
        </div>
      </div>
      
      <ScoringConfigPanel 
        scoring={element.scoring} 
        updateScoring={(scoring) => update({ ...element, scoring })}
        possibleAnswers={element.config.allowedKeys}
      />
    </div>
  );
}

function MultipleChoiceConfig({ element, update }: { element: any, update: (e: any) => void }) {
  const updateOption = (id: string, val: string) => {
    const opts = element.config.options.map((o: any) => o.id === id ? { ...o, label: val } : o);
    update({ ...element, config: { ...element.config, options: opts } });
  };

  const removeOption = (id: string) => {
    const opts = element.config.options.filter((o: any) => o.id !== id);
    let newScoring = { ...element.scoring };
    if (newScoring.correctAnswer === id) newScoring.correctAnswer = undefined;
    update({ ...element, config: { ...element.config, options: opts }, scoring: newScoring });
  };

  const addOption = () => {
    update({
      ...element,
      config: { ...element.config, options: [...element.config.options, { id: generateId(), label: `Option ${element.config.options.length + 1}` }] }
    });
  };

  return (
    <div className="mt-3 space-y-2">
      {element.config.options.map((opt: any, i: number) => (
        <div key={opt.id} className="flex items-center gap-2 group">
          <input type="radio" disabled className="w-4 h-4 text-blue-600 border-slate-300" />
          <input 
            type="text" 
            value={opt.label}
            onChange={(e) => updateOption(opt.id, e.target.value)}
            className="flex-1 text-sm border-b border-transparent hover:border-slate-200 focus:border-blue-500 p-1 outline-none bg-transparent" 
            placeholder={`Option ${i + 1}`} 
          />
          {element.config.options.length > 2 && (
            <button onClick={() => removeOption(opt.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 px-2">&times;</button>
          )}
        </div>
      ))}
      <button onClick={addOption} className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1 hover:underline ml-6">
        <Plus className="w-3 h-3" /> Add Option
      </button>
      
      <ScoringConfigPanel 
        scoring={element.scoring} 
        updateScoring={(scoring) => update({ ...element, scoring })}
        possibleAnswers={element.config.options.map((o: any) => o.id)}
        answerLabels={element.config.options.map((o: any) => o.label)}
      />
    </div>
  );
}

function SliderRatingConfig({ element, update }: { element: any, update: (e: any) => void }) {
  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Minimum Value</label>
          <input type="number" value={element.config.min} onChange={(e) => update({ ...element, config: { ...element.config, min: Number(e.target.value) } })} className="w-full text-sm border rounded p-1.5 outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Maximum Value</label>
          <input type="number" value={element.config.max} onChange={(e) => update({ ...element, config: { ...element.config, max: Number(e.target.value) } })} className="w-full text-sm border rounded p-1.5 outline-none focus:border-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Left Label (Optional)</label>
          <input type="text" value={element.config.leftLabel || ''} onChange={(e) => update({ ...element, config: { ...element.config, leftLabel: e.target.value } })} className="w-full text-sm border rounded p-1.5 outline-none focus:border-blue-500" placeholder="e.g. Strongly Disagree" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Right Label (Optional)</label>
          <input type="text" value={element.config.rightLabel || ''} onChange={(e) => update({ ...element, config: { ...element.config, rightLabel: e.target.value } })} className="w-full text-sm border rounded p-1.5 outline-none focus:border-blue-500" placeholder="e.g. Strongly Agree" />
        </div>
      </div>
    </div>
  );
}

function TextInputConfig({ element, update }: { element: any, update: (e: any) => void }) {
  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Placeholder Text (Optional)</label>
        <input 
          type="text" 
          value={element.config.placeholder || ''} 
          onChange={(e) => update({ ...element, config: { ...element.config, placeholder: e.target.value } })} 
          className="w-full border rounded p-1.5 text-sm outline-none focus:border-blue-500" 
          placeholder="e.g. Type your answer here..."
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input 
            type="checkbox" 
            checked={element.config.multiline || false} 
            onChange={(e) => update({ ...element, config: { ...element.config, multiline: e.target.checked } })}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          />
          Multi-line response (Paragraph)
        </label>
      </div>
      
      <ScoringConfigPanel 
        scoring={element.scoring} 
        updateScoring={(scoring) => update({ ...element, scoring })}
        possibleAnswers={[]}
      />
    </div>
  );
}

// --- MAIN BUILDER ---

export default function BuilderPage() {
  const params = useParams();
  
  const [trials, setTrials] = useState<Trial[]>([]);
  const [activeTrialId, setActiveTrialId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved'|'saving'|'error'>('saved');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(`bitnbuild:experiment:${params.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.trials) {
          setTrials(parsed.trials);
          if (parsed.trials.length > 0) setActiveTrialId(parsed.trials[0].id);
          return;
        }
      } catch (e) {}
    }
    
    // Default Trial Initialization
    const defaultId = generateId();
    setTrials([{ 
      id: defaultId, 
      name: 'Welcome Trial', 
      elements: [], 
      advanceMode: 'response', 
      durationMs: null 
    }]);
    setActiveTrialId(defaultId);
  }, [params.id]);

  useEffect(() => {
    if (!mounted) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`bitnbuild:experiment:${params.id}`, JSON.stringify({
          id: params.id,
          trials
        }));
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [trials, mounted, params.id]);

  if (!mounted) return <div className="h-screen flex items-center justify-center bg-slate-50">Loading Builder...</div>;

  // --- ACTIONS ---

  const addTrial = () => {
    const newId = generateId();
    setTrials([...trials, { 
      id: newId, 
      name: `Trial ${trials.length + 1}`, 
      elements: [], 
      advanceMode: 'response', 
      durationMs: null 
    }]);
    setActiveTrialId(newId);
  };

  const duplicateTrial = (trial: Trial, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = generateId();
    // Deep clone elements and give them new IDs
    const clonedElements = trial.elements.map(el => ({
      ...JSON.parse(JSON.stringify(el)),
      id: generateId()
    }));
    
    setTrials([...trials, { 
      ...trial, 
      id: newId, 
      name: `${trial.name} (Copy)`, 
      elements: clonedElements 
    }]);
  };

  const deleteTrial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = trials.filter(t => t.id !== id);
    setTrials(filtered);
    if (activeTrialId === id && filtered.length > 0) {
      setActiveTrialId(filtered[0].id);
    }
  };

  const updateTrialProps = (id: string, updates: Partial<Trial>) => {
    setTrials(trials.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const createElementInstance = (type: string): ExperimentElement => {
    const id = generateId();
    switch (type) {
      case 'TEXT_INSTRUCTION': return { id, type, role: 'DISPLAY', config: { text: '' } } as any;
      case 'IMAGE_VISUAL': return { id, type, role: 'DISPLAY', config: { url: '', altText: '' } } as any;
      case 'AUDIO_SOUND': return { id, type, role: 'DISPLAY', config: { url: '', autoplay: false } } as any;
      case 'FIXATION_CROSS': return { id, type, role: 'DISPLAY', config: { style: '+' } } as any;
      case 'KEYBOARD_PRESS': return { id, type, role: 'RESPONSE', config: { allowedKeys: [] }, scoring: getDefaultScoring() } as any;
      case 'MOUSE_CLICK': return { id, type, role: 'RESPONSE', config: {}, scoring: getDefaultScoring() } as any;
      case 'MULTIPLE_CHOICE': return { 
        id, type, role: 'RESPONSE', 
        config: { options: [{ id: generateId(), label: 'Option 1' }, { id: generateId(), label: 'Option 2' }] }, 
        scoring: getDefaultScoring() 
      } as any;
      case 'SLIDER_RATING': return { 
        id, type, role: 'RESPONSE', 
        config: { min: 1, max: 7, step: 1, defaultValue: 4 }, 
        scoring: getDefaultScoring() 
      } as any;
      case 'TEXT_INPUT': return {
        id, type, role: 'RESPONSE',
        config: { placeholder: '', multiline: false },
        scoring: getDefaultScoring()
      } as any;
      default: throw new Error(`Unknown type ${type}`);
    }
  };

  const addElementToTrial = (trialId: string, type: string) => {
    const el = createElementInstance(type);
    setTrials(trials.map(t => t.id === trialId ? { ...t, elements: [...t.elements, el] } : t));
  };

  const updateElement = (trialId: string, elementId: string, updatedEl: ExperimentElement) => {
    setTrials(trials.map(t => {
      if (t.id === trialId) {
        return { ...t, elements: t.elements.map(e => e.id === elementId ? updatedEl : e) };
      }
      return t;
    }));
  };

  const removeElement = (trialId: string, elementId: string) => {
    setTrials(trials.map(t => {
      if (t.id === trialId) {
        return { ...t, elements: t.elements.filter(e => e.id !== elementId) };
      }
      return t;
    }));
  };
  
  const moveElement = (trialId: string, index: number, direction: 'up' | 'down') => {
    setTrials(trials.map(t => {
      if (t.id === trialId) {
        const els = [...t.elements];
        if (direction === 'up' && index > 0) {
          [els[index-1], els[index]] = [els[index], els[index-1]];
        } else if (direction === 'down' && index < els.length - 1) {
          [els[index+1], els[index]] = [els[index], els[index+1]];
        }
        return { ...t, elements: els };
      }
      return t;
    }));
  };

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'TEXT_INSTRUCTION': return <Type className="w-4 h-4 text-blue-500" />;
      case 'IMAGE_VISUAL': return <ImageIcon className="w-4 h-4 text-blue-500" />;
      case 'AUDIO_SOUND': return <Volume2 className="w-4 h-4 text-blue-500" />;
      case 'FIXATION_CROSS': return <Crosshair className="w-4 h-4 text-blue-500" />;
      case 'KEYBOARD_PRESS': return <Keyboard className="w-4 h-4 text-emerald-500" />;
      case 'MOUSE_CLICK': return <MousePointer2 className="w-4 h-4 text-emerald-500" />;
      case 'MULTIPLE_CHOICE': return <List className="w-4 h-4 text-emerald-500" />;
      case 'SLIDER_RATING': return <SlidersHorizontal className="w-4 h-4 text-emerald-500" />;
      case 'TEXT_INPUT': return <Type className="w-4 h-4 text-emerald-500" />;
      default: return <GripVertical className="w-4 h-4" />;
    }
  };

  const getElementLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-8 bg-slate-50">
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/researcher/experiments/${params.id}`} className="font-semibold hover:text-blue-600">Experiment Setup</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium">Visual Builder</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs ${saveStatus === 'saving' ? 'text-amber-500' : saveStatus === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save Failed' : 'All changes saved'}
          </span>
          <Link href={`/researcher/experiments/${params.id}/preview`} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800">
            <Play className="w-4 h-4" /> Preview
          </Link>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex flex-col items-center">
          <div className="w-full max-w-3xl space-y-6 pb-20">
            {trials.length === 0 && (
              <div className="text-center py-12 text-slate-400">No trials yet. Click "Add Next Trial" below.</div>
            )}
            
            {trials.map((trial, idx) => (
              <div 
                key={trial.id} 
                className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${activeTrialId === trial.id ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-blue-300'}`}
                onClick={() => setActiveTrialId(trial.id)}
              >
                <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                    <span className="font-semibold text-slate-900">{trial.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <Settings className="w-4 h-4 hover:text-slate-700 transition-colors" />
                    <Copy className="w-4 h-4 hover:text-slate-700 transition-colors" onClick={(e) => duplicateTrial(trial, e)} />
                    <Trash2 className="w-4 h-4 hover:text-red-500 transition-colors" onClick={(e) => deleteTrial(trial.id, e)} />
                  </div>
                </div>
                
                <div className="p-5">
                  {/* Element List Area */}
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Trial Elements</h4>
                    {trial.elements.length === 0 ? (
                      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
                        <p className="text-sm text-slate-500">No elements added.</p>
                        <p className="text-xs text-slate-400 mt-1">Click a button below to add stimuli or responses.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {trial.elements.map((el, i) => (
                          <div key={el.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getElementIcon(el.type)}
                                <span className="text-sm font-bold text-slate-800">{getElementLabel(el.type)}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{el.role}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => moveElement(trial.id, i, 'up')} disabled={i===0} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                                <button onClick={() => moveElement(trial.id, i, 'down')} disabled={i===trial.elements.length-1} className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                                <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                <button onClick={() => removeElement(trial.id, el.id)} className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-slate-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                            
                            {el.type === 'TEXT_INSTRUCTION' && <TextInstructionConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'IMAGE_VISUAL' && <ImageVisualConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'AUDIO_SOUND' && <AudioSoundConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'FIXATION_CROSS' && <FixationCrossConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'KEYBOARD_PRESS' && <KeyboardConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'MULTIPLE_CHOICE' && <MultipleChoiceConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'SLIDER_RATING' && <SliderRatingConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'TEXT_INPUT' && <TextInputConfig element={el} update={(updated) => updateElement(trial.id, el.id, updated)} />}
                            {el.type === 'MOUSE_CLICK' && <div className="text-sm text-slate-500 italic mt-2">Records timestamp and coordinates on click.</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Add Element Buttons */}
                  <div className="border-t border-slate-100 pt-4 mt-4 grid grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Add Stimulus</h4>
                      <div className="flex flex-wrap gap-2">
                        {['TEXT_INSTRUCTION', 'IMAGE_VISUAL', 'AUDIO_SOUND', 'FIXATION_CROSS'].map(type => (
                          <button key={type} onClick={() => addElementToTrial(trial.id, type)} className="px-2.5 py-1.5 border border-slate-200 rounded text-xs hover:bg-slate-50 hover:border-blue-300 text-slate-600 flex items-center gap-1.5 transition-colors bg-white">
                            {getElementIcon(type)} {getElementLabel(type)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Add Response</h4>
                      <div className="flex flex-wrap gap-2">
                        {['KEYBOARD_PRESS', 'MOUSE_CLICK', 'MULTIPLE_CHOICE', 'SLIDER_RATING', 'TEXT_INPUT'].map(type => (
                          <button key={type} onClick={() => addElementToTrial(trial.id, type)} className="px-2.5 py-1.5 border border-slate-200 rounded text-xs hover:bg-slate-50 hover:border-emerald-300 text-slate-600 flex items-center gap-1.5 transition-colors bg-white">
                            {getElementIcon(type)} {getElementLabel(type)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="flex justify-center pt-2">
              <button onClick={addTrial} className="py-2.5 px-6 border border-slate-300 rounded-full text-slate-600 font-medium hover:bg-white shadow-sm flex items-center gap-2 transition-all hover:border-blue-400 hover:text-blue-600 bg-slate-50">
                <Plus className="w-4 h-4" /> Add Next Trial
              </button>
            </div>
          </div>
        </div>

        {/* Properties Inspector */}
        <div className="w-80 bg-white border-l flex flex-col shrink-0">
          <div className="p-4 font-medium border-b text-sm bg-slate-50">
            {activeTrialId ? `Properties: ${trials.find(t => t.id === activeTrialId)?.name || ''}` : 'Properties Inspector'}
          </div>
          <div className="overflow-y-auto p-5 space-y-6">
            {activeTrialId ? (() => {
              const trial = trials.find(t => t.id === activeTrialId);
              if (!trial) return null;
              
              return (
                <div>
                  <h3 className="font-semibold mb-4 text-slate-800">Trial Execution Settings</h3>
                  <div className="space-y-5 text-sm">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Trial Name</label>
                      <input 
                        type="text" 
                        className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                        value={trial.name}
                        onChange={(e) => updateTrialProps(trial.id, { name: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Advance Mode</label>
                      <select 
                        className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-white"
                        value={trial.advanceMode}
                        onChange={(e) => updateTrialProps(trial.id, { advanceMode: e.target.value as AdvanceMode })}
                      >
                        <option value="response">Wait for response</option>
                        <option value="timed">Auto-advance (Timed)</option>
                        <option value="response_or_timeout">Response OR Timeout</option>
                        <option value="manual">Manual continuation</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {trial.advanceMode === 'response' && 'Trial stays on screen indefinitely until the participant submits a response.'}
                        {trial.advanceMode === 'timed' && 'Trial advances automatically after a set duration, ignoring responses.'}
                        {trial.advanceMode === 'response_or_timeout' && 'Trial advances if user responds, or when time runs out (whichever comes first).'}
                        {trial.advanceMode === 'manual' && 'Trial stays until explicit manual intervention or special logic.'}
                      </p>
                    </div>

                    {(trial.advanceMode === 'timed' || trial.advanceMode === 'response_or_timeout') && (
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Duration / Timeout (ms)</label>
                        <input 
                          type="number" 
                          className="w-full border border-slate-200 rounded-md px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                          value={trial.durationMs || ''}
                          onChange={(e) => updateTrialProps(trial.id, { durationMs: e.target.value ? Number(e.target.value) : null })}
                          placeholder="e.g. 2000"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Validation warnings panel could go here */}
                  <div className="mt-8 pt-4 border-t border-slate-100">
                    <h3 className="font-semibold mb-3 text-slate-800 text-xs uppercase tracking-wider text-slate-400">Validation</h3>
                    {trial.elements.length === 0 ? (
                      <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">ERROR: Trial has no elements.</div>
                    ) : (trial.advanceMode === 'response' && !trial.elements.some(e => e.role === 'RESPONSE')) ? (
                      <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">ERROR: Advance Mode requires a response, but no response elements exist.</div>
                    ) : (
                      <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Trial configuration looks valid.
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-slate-400">Select a trial to edit its properties.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
