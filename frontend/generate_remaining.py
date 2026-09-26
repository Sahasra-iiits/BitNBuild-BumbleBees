import os

BASE = 'e:/BitNBuild/frontend/src/app'

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')

print("Generating remaining pages...")

# 1. Visual Experiment Builder (Massive Upgrade)
write_file(f'{BASE}/researcher/experiments/[id]/builder/page.tsx', '''
"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Play, Copy, Trash2, Settings, Plus, GripVertical } from 'lucide-react';

export default function BuilderPage() {
  const params = useParams();
  const [trials, setTrials] = useState([{ id: 1, name: 'Welcome Screen', elements: ['Instruction Text'] }, { id: 2, name: 'Fixation', elements: ['Fixation Cross'] }]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -m-8 bg-slate-50">
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/researcher/experiments/${params.id}`} className="font-semibold hover:text-blue-600">Experiment Setup</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium">Visual Builder</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">All changes saved</span>
          <Link href={`/researcher/experiments/${params.id}/preview`} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800">
            <Play className="w-4 h-4" /> Preview
          </Link>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Element Library */}
        <div className="w-64 bg-white border-r flex flex-col shrink-0">
          <div className="p-4 font-medium border-b text-sm bg-slate-50">Elements Library</div>
          <div className="overflow-y-auto p-4 space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Stimuli</div>
              <div className="space-y-2">
                {['Text Instruction', 'Image / Visual', 'Audio / Sound', 'Fixation Cross'].map(el => (
                  <div key={el} className="p-2 border rounded-md text-sm bg-white cursor-grab hover:border-blue-400 shadow-sm flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-300" /> {el}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Responses</div>
              <div className="space-y-2">
                {['Keyboard Press', 'Mouse Click', 'Multiple Choice', 'Slider Rating'].map(el => (
                  <div key={el} className="p-2 border rounded-md text-sm bg-white cursor-grab hover:border-blue-400 shadow-sm flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-300" /> {el}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-6 pb-20">
            {trials.map((trial, idx) => (
              <div key={trial.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                    <span className="font-semibold text-slate-900">Trial {idx + 1}: {trial.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Settings className="w-4 h-4 hover:text-slate-700 cursor-pointer" />
                    <Copy className="w-4 h-4 hover:text-slate-700 cursor-pointer" />
                    <Trash2 className="w-4 h-4 hover:text-red-500 cursor-pointer" />
                  </div>
                </div>
                <div className="p-4 space-y-3 min-h-[100px] border-2 border-dashed border-transparent hover:border-slate-200 transition-colors">
                  {trial.elements.map((el, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm font-medium text-blue-900 flex justify-between items-center">
                      {el}
                    </div>
                  ))}
                  <div className="text-center py-2 text-sm text-slate-400 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50">
                    + Drag element here
                  </div>
                </div>
              </div>
            ))}
            <button className="w-full py-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors">
              <Plus className="w-5 h-5" /> Add Trial
            </button>
          </div>
        </div>

        {/* Properties Inspector */}
        <div className="w-80 bg-white border-l flex flex-col shrink-0">
          <div className="p-4 font-medium border-b text-sm bg-slate-50">Properties Inspector</div>
          <div className="overflow-y-auto p-5 space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Trial Settings</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-500 mb-1">Trial Name</label>
                  <input type="text" className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-500" defaultValue="Target Stimulus" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Stimulus Duration (ms)</label>
                  <input type="number" className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-500" defaultValue="1500" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Response Window (ms)</label>
                  <input type="number" className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-500" defaultValue="2000" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
''')

# 2. Logic Builder
write_file(f'{BASE}/researcher/experiments/[id]/logic/page.tsx', '''
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
''')

# 3. Quality Rules
write_file(f'{BASE}/researcher/experiments/[id]/quality/page.tsx', '''
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
''')

# 4. Raw Data View
write_file(f'{BASE}/researcher/experiments/[id]/data/page.tsx', '''
"use client";
import Link from 'next/link';

export default function RawDataPage() {
  const rows = Array.from({length: 15}).map((_, i) => ({
    pid: `P-${1000 + i}`,
    tid: `T-${i%3 + 1}`,
    cond: i % 2 === 0 ? 'A' : 'B',
    resp: i % 4 === 0 ? 'y' : 'n',
    rt: Math.floor(400 + Math.random() * 500),
    correct: i % 5 !== 0,
    exc: i === 12
  }));

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Raw Data View</span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Raw Data</h1>
      
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b">
              <tr>
                <th className="px-4 py-3">Participant ID</th>
                <th className="px-4 py-3">Trial ID</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Response</th>
                <th className="px-4 py-3">Reaction Time (ms)</th>
                <th className="px-4 py-3">Correct</th>
                <th className="px-4 py-3">Excluded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono">{r.pid}</td>
                  <td className="px-4 py-2">{r.tid}</td>
                  <td className="px-4 py-2">{r.cond}</td>
                  <td className="px-4 py-2 font-mono font-bold">{r.resp}</td>
                  <td className="px-4 py-2">{r.rt}</td>
                  <td className="px-4 py-2">{r.correct ? '✅' : '❌'}</td>
                  <td className="px-4 py-2">{r.exc ? <span className="text-red-500 font-bold">Yes</span> : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t text-sm text-slate-500 text-center">Showing 15 of 2,450 rows.</div>
      </div>
    </div>
  );
}
''')

# 5. Publish Review
write_file(f'{BASE}/researcher/experiments/[id]/publish/page.tsx', '''
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
''')

# 6. Participant Dashboard
write_file(f'{BASE}/participant/page.tsx', '''
"use client";
import Link from 'next/link';
import { Star, ShieldCheck, Trophy, ChevronRight } from 'lucide-react';

export default function ParticipantDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, Participant</h1>
          <p className="text-slate-500 mt-1">Ready to contribute to science today?</p>
        </div>
        <div className="text-right flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Quality Score</div>
            <div className="text-2xl font-black text-blue-600">85<span className="text-slate-400 text-sm font-normal">/100</span></div>
          </div>
          <ShieldCheck className="w-10 h-10 text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/participant/experiments" className="group bg-blue-600 text-white p-6 rounded-2xl shadow-md hover:bg-blue-700 transition-colors">
          <h3 className="text-xl font-bold mb-2">Find Experiments</h3>
          <p className="text-blue-100 text-sm mb-4">Discover new studies matching your eligibility.</p>
          <div className="flex justify-end"><ChevronRight className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" /></div>
        </Link>
        <div className="bg-white p-6 border rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-indigo-600"><Trophy className="w-5 h-5"/> <h3 className="font-bold">Level 3 Researcher</h3></div>
          <p className="text-slate-500 text-sm mb-4">Complete 4 more studies to reach Level 4.</p>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-indigo-600 h-2 rounded-full w-3/4"></div></div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">In Progress</h2>
        <div className="bg-white border rounded-xl p-6 text-center text-slate-500">
          You don't have any incomplete studies.
        </div>
      </div>
    </div>
  );
}
''')

# 7. Participant Discovery
write_file(f'{BASE}/participant/experiments/page.tsx', '''
"use client";
import Link from 'next/link';

export default function DiscoveryPage() {
  const exps = [
    { id: 'exp-1', title: 'Visual Working Memory', lab: 'Cognitive Science Lab', time: '15 mins', reward: 10, req: 80 },
    { id: 'exp-2', title: 'Lexical Decision Task', lab: 'Linguistics Dept', time: '5 mins', reward: 5, req: 60 }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Available Experiments</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exps.map(e => (
          <div key={e.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">{e.title}</h2>
              <p className="text-sm text-slate-500 mb-4">{e.lab}</p>
              <div className="flex gap-4 text-sm mb-6">
                <span className="bg-slate-100 px-3 py-1 rounded-full">{e.time}</span>
                <span className="bg-blue-50 text-blue-700 font-medium px-3 py-1 rounded-full">+{e.reward} Points</span>
              </div>
            </div>
            <Link href={`/participant/experiments/${e.id}/run`} className="block text-center bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800">
              Start Experiment
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
''')

print("All advanced features generated!")
