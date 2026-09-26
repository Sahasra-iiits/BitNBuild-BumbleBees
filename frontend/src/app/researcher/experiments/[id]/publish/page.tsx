"use client";
import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function PublishPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Review & Publish</h1>
        <p className="text-slate-500 mt-2">Ensure all configurations are correct before going live.</p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-semibold text-lg">Pre-flight Checklist</div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Basic Information complete</div>
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Trials configured (12 total)</div>
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Timing validated</div>
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Quality rules active</div>
          <div className="flex items-center gap-3 text-slate-500"><AlertCircle className="w-5 h-5"/> Logic branching (Not used)</div>
        </div>
      </div>

      <div className="flex justify-center">
        <button className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-emerald-700 shadow-md transition-transform hover:-translate-y-0.5">
          Publish Experiment
        </button>
      </div>
    </div>
  );
}
