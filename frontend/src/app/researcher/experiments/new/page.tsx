"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { experimentsApi } from '@/lib/api/experiments';

const STEPS = [
  'Basic Information',
  'Experiment Design',
  'Trials',
  'Logic',
  'Randomization',
  'Participant Access',
  'Data Collection',
  'Quality Rules',
  'Preview',
  'Publish'
];

export default function CreateExperimentStepper() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!title) return; // Prevent empty title
      setIsSaving(true);
      try {
        const exp = await experimentsApi.create({ title, description });
        // After creating the initial draft, forward them to the full builder
        router.push(`/researcher/experiments/${exp.id}/builder`);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col min-h-[600px]">
      
      {/* Stepper Header */}
      <div className="bg-slate-50 border-b px-6 py-4 flex gap-2 overflow-x-auto">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 whitespace-nowrap">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
              idx === currentStep ? 'bg-blue-600 text-white' : 
              idx < currentStep ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className={`text-sm font-medium ${idx === currentStep ? 'text-blue-900' : 'text-slate-500'}`}>
              {step}
            </span>
            {idx < STEPS.length - 1 && <div className="w-4 h-px bg-slate-300 mx-2"></div>}
          </div>
        ))}
      </div>

      {/* Stepper Content */}
      <div className="flex-1 p-8">
        {currentStep === 0 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Basic Information</h2>
              <p className="text-slate-500 mt-2">Let's start with the name and objective of your research.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Experiment Title</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                placeholder="e.g., Visual Working Memory Task" 
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description & Objectives</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[120px]" 
                placeholder="Briefly describe the purpose of this study..." 
              />
            </div>
          </div>
        )}
        
        {currentStep > 0 && (
          <div className="flex items-center justify-center h-full text-slate-500">
            This step is managed within the main Builder interface.
          </div>
        )}
      </div>

      {/* Stepper Footer */}
      <div className="bg-slate-50 border-t px-6 py-4 flex justify-between items-center">
        <button 
          onClick={() => setCurrentStep(prev => Math.max(prev - 1, 0))}
          disabled={currentStep === 0}
          className="px-4 py-2 border bg-white rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">Autosaves continuously</span>
          <button 
            onClick={handleNext}
            disabled={isSaving || (currentStep === 0 && !title)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
