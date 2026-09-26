"use client";
import Link from 'next/link';

export default function QualityRulesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Quality Rules</span>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Quality Controls</h1>
        <p className="text-slate-500 mt-1">Set thresholds to automatically flag suspicious participation.</p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm divide-y">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold">Fast Responders</h2>
              <p className="text-sm text-slate-500">Flag trials where reaction time is impossibly fast.</p>
            </div>
            <input type="checkbox" defaultChecked className="accent-blue-600 w-5 h-5" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Flag if RT is under</span>
            <input type="number" defaultValue="150" className="w-24 border rounded-md px-3 py-1 outline-none" />
            <span className="text-sm font-medium">ms</span>
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold">Identical Responses</h2>
              <p className="text-sm text-slate-500">Flag participants who mash the same key repeatedly.</p>
            </div>
            <input type="checkbox" defaultChecked className="accent-blue-600 w-5 h-5" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Flag if identical for</span>
            <input type="number" defaultValue="10" className="w-20 border rounded-md px-3 py-1 outline-none" />
            <span className="text-sm font-medium">consecutive trials</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-500 italic">* Note: These signals trigger a "Review Required" flag, they do not automatically ban participants.</p>
    </div>
  );
}
