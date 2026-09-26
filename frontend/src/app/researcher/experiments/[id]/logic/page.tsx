"use client";
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function LogicBuilderPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Logic & Branching</span>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conditional Logic</h1>
        <p className="text-slate-500 mt-1">Configure complex branching without writing code.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 font-semibold text-blue-900">Rule 1: Accuracy Check</div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-900 text-white rounded font-bold text-sm">IF</span>
              <select className="border rounded-md px-3 py-2 bg-slate-50"><option>Trial 4 Response</option></select>
              <select className="border rounded-md px-3 py-2 bg-slate-50"><option>=</option></select>
              <select className="border rounded-md px-3 py-2 bg-slate-50"><option>Correct</option></select>
            </div>
            <div className="flex items-center gap-4 pl-12">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-sm">THEN</span>
              <select className="border rounded-md px-3 py-2 bg-slate-50"><option>Go to Next Trial</option></select>
            </div>
            <div className="flex items-center gap-4 pl-12">
              <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded font-bold text-sm">ELSE</span>
              <select className="border rounded-md px-3 py-2 bg-slate-50"><option>Show Feedback</option></select>
              <input type="text" className="border rounded-md px-3 py-2 flex-1" defaultValue="Incorrect! Please pay attention." />
            </div>
          </div>
        </div>
        
        <button className="flex items-center gap-2 text-blue-600 font-medium px-4 py-2 hover:bg-blue-50 rounded-md transition-colors">
          <Plus className="w-4 h-4" /> Add Logic Rule
        </button>
      </div>
    </div>
  );
}
