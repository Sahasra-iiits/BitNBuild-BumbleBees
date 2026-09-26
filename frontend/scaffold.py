import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')

BASE = 'e:/BitNBuild/frontend/src'

print("Scaffolding pages...")

# Global Layout
write_file(f'{BASE}/app/layout.tsx', '''
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CogniScale - Research Platform',
  description: 'Secure, flexible, and high-precision behavioral experiments.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}
''')

# Landing Page
write_file(f'{BASE}/app/page.tsx', '''
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div className="font-bold text-xl tracking-tight">CogniScale</div>
        <nav className="flex gap-6">
          <Link href="/experiments" className="text-sm font-medium hover:text-blue-600">Experiments</Link>
          <Link href="/how-it-works" className="text-sm font-medium hover:text-blue-600">How It Works</Link>
          <Link href="/login" className="text-sm font-medium hover:text-blue-600">Login</Link>
          <Link href="/register" className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800">Sign Up</Link>
        </nav>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <h1 className="text-5xl font-extrabold tracking-tight mb-6 max-w-3xl">
          Build behavioral experiments.<br/>
          <span className="text-blue-600">Collect research-grade data.</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mb-10">
          A secure, flexible, and high-precision SaaS platform empowering researchers to build and deploy complex behavioral experiments directly in the browser.
        </p>
        <div className="flex gap-4">
          <Link href="/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 shadow-sm">
            Create an Experiment
          </Link>
          <Link href="/experiments" className="bg-white border border-slate-200 text-slate-900 px-8 py-3 rounded-lg font-medium text-lg hover:bg-slate-50 shadow-sm">
            Explore Experiments
          </Link>
        </div>
      </main>
    </div>
  );
}
''')

# Researcher Layout
write_file(f'{BASE}/app/researcher/layout.tsx', '''
import Link from 'next/link';

export default function ResearcherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-4 border-b font-bold tracking-tight">CogniScale Researcher</div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link href="/researcher/experiments" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Experiments</Link>
          <Link href="/researcher/experiments/new" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Create New</Link>
          <Link href="/researcher/profile" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Profile</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
''')

# Researcher Dashboard
write_file(f'{BASE}/app/researcher/experiments/page.tsx', '''
"use client";
import { useEffect, useState } from 'react';
import { experimentsApi } from '@/lib/api/experiments';
import { Experiment } from '@/lib/types';
import Link from 'next/link';

export default function ResearcherDashboard() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    experimentsApi.getExperiments().then(data => {
      setExperiments(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Experiments</h1>
        <Link href="/researcher/experiments/new" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          Create Experiment
        </Link>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Visibility</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map(exp => (
              <tr key={exp.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">{exp.title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    exp.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {exp.status}
                  </span>
                </td>
                <td className="px-6 py-4">{exp.visibility}</td>
                <td className="px-6 py-4 space-x-3">
                  <Link href={`/researcher/experiments/${exp.id}/builder`} className="text-blue-600 hover:underline">Builder</Link>
                  <Link href={`/researcher/experiments/${exp.id}/results`} className="text-blue-600 hover:underline">Results</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
''')

# Visual Experiment Builder
write_file(f'{BASE}/app/researcher/experiments/[id]/builder/page.tsx', '''
"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { experimentsApi } from '@/lib/api/experiments';
import { ExperimentConfiguration, Trial } from '@/lib/types';

export default function BuilderPage() {
  const params = useParams();
  const [config, setConfig] = useState<ExperimentConfiguration | null>(null);

  useEffect(() => {
    experimentsApi.getConfiguration(params.id as string).then(setConfig);
  }, [params.id]);

  if (!config) return <div className="p-8">Loading builder...</div>;

  return (
    <div className="flex h-screen -m-8 flex-col bg-slate-100">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <h1 className="font-semibold text-lg">Experiment Builder</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">Autosaved</span>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm">Preview</button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Elements Library */}
        <div className="w-64 bg-white border-r flex flex-col">
          <div className="p-4 font-medium border-b text-sm">Elements</div>
          <div className="p-4 space-y-2">
            {['Instruction', 'Image', 'Fixation', 'Keyboard Response'].map(el => (
              <div key={el} className="p-3 border rounded-md text-sm bg-slate-50 cursor-grab hover:bg-slate-100">
                {el}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto p-8 items-center">
          <div className="w-full max-w-2xl space-y-4">
            {config.trials.map((trial, index) => (
              <div key={trial.id} className="bg-white p-4 border rounded-lg shadow-sm">
                <div className="font-medium mb-2">Trial {index + 1}: {trial.name}</div>
                <div className="space-y-2">
                  {trial.elements.map(el => (
                    <div key={el.id} className="bg-slate-50 p-2 border border-slate-200 rounded text-sm text-slate-600">
                      {el.type}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-80 bg-white border-l flex flex-col">
          <div className="p-4 font-medium border-b text-sm">Properties</div>
          <div className="p-4 text-sm text-slate-500">
            Select an element or trial to edit its properties.
          </div>
        </div>
      </div>
    </div>
  );
}
''')

# High Precision Experiment Runner component
write_file(f'{BASE}/components/experiment/Runner.tsx', '''
"use client";
import { useEffect, useRef, useState } from 'react';
import { ExperimentConfiguration, Trial, TrialResponse } from '@/lib/types';
import { participantApi } from '@/lib/api/experiments';

interface RunnerProps {
  sessionId: string;
  config: ExperimentConfiguration;
  onComplete: () => void;
}

export default function Runner({ sessionId, config, onComplete }: RunnerProps) {
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // Use refs for high-precision mutable state without re-rendering
  const trialStartTime = useRef<number>(0);
  const buffer = useRef<TrialResponse[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trial = config.trials[currentTrialIndex];

  const flushBuffer = async () => {
    if (buffer.current.length > 0) {
      const responsesToSync = [...buffer.current];
      buffer.current = [];
      await participantApi.syncSessionResponses(sessionId, responsesToSync);
    }
  };

  const nextTrial = async () => {
    if (currentTrialIndex < config.trials.length - 1) {
      setCurrentTrialIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
      await flushBuffer();
      await participantApi.completeSession(sessionId);
      onComplete();
    }
  };

  useEffect(() => {
    if (!trial) return;
    
    // High-precision start timestamp
    trialStartTime.current = performance.now();

    const handleKeydown = (e: KeyboardEvent) => {
      // Look for a keyboard response element in this trial
      const kbElement = trial.elements.find(el => el.type === 'keyboard_response');
      if (!kbElement) return;

      const allowedKeys = kbElement.properties.allowedKeys || [];
      if (allowedKeys.includes(e.key.toLowerCase())) {
        const reactionTime = performance.now() - trialStartTime.current;
        
        buffer.current.push({
          trialId: trial.id,
          response: e.key.toLowerCase(),
          reactionTimeMs: reactionTime,
          trialDurationMs: reactionTime, // Responded early
          isCorrect: trial.correctResponse ? e.key.toLowerCase() === trial.correctResponse : undefined,
          timestamp: new Date().toISOString()
        });

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        // Check batch threshold (e.g. sync every 5 responses)
        if (buffer.current.length >= 5) {
          flushBuffer();
        }

        nextTrial();
      }
    };

    window.addEventListener('keydown', handleKeydown);

    // Auto-advance if stimulus duration or response window expires without response
    if (trial.stimulusDurationMs) {
       timeoutRef.current = setTimeout(() => {
          // If no keyboard response required, just advance
          const kbElement = trial.elements.find(el => el.type === 'keyboard_response');
          if (!kbElement) {
            nextTrial();
          }
       }, trial.stimulusDurationMs);
    }

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentTrialIndex, trial]);

  if (isFinished || !trial) {
    return <div className="flex h-screen items-center justify-center bg-white text-slate-800">Experiment Completing...</div>;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white text-slate-900 select-none">
      <div className="max-w-4xl w-full text-center space-y-8">
        {trial.elements.map(el => {
          if (el.type === 'instruction') return <h2 key={el.id} className="text-3xl font-medium">{el.properties.text}</h2>;
          if (el.type === 'fixation') return <div key={el.id} className="text-5xl font-light">+</div>;
          if (el.type === 'image') return <img key={el.id} src={el.properties.src} className="mx-auto border border-slate-200" alt="stimulus" />;
          if (el.type === 'question') return <p key={el.id} className="text-xl font-medium">{el.properties.text}</p>;
          return null;
        })}
      </div>
    </div>
  );
}
''')

# Participant Experiment View
write_file(f'{BASE}/app/participant/experiments/[id]/run/page.tsx', '''
"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { experimentsApi } from '@/lib/api/experiments';
import { ExperimentConfiguration } from '@/lib/types';
import Runner from '@/components/experiment/Runner';

export default function RunExperimentPage() {
  const params = useParams();
  const router = useRouter();
  const [config, setConfig] = useState<ExperimentConfiguration | null>(null);
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    experimentsApi.getConfiguration(params.id as string).then(setConfig);
  }, [params.id]);

  if (!config) {
    return <div className="p-8 text-center">Loading experiment assets...</div>;
  }

  if (!hasConsented) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full p-8 rounded-lg shadow-sm border">
          <h1 className="text-2xl font-bold mb-4">Informed Consent</h1>
          <div className="prose mb-8 text-sm text-slate-600 space-y-4">
            <p>You are invited to participate in a research study. The purpose of this research is to investigate visual working memory.</p>
            <p>Your participation is completely voluntary. You may decline to participate or withdraw from the study at any time without penalty.</p>
            <p>All data collected will be completely anonymous and used solely for research purposes.</p>
            <p>If you have any questions, please contact the researcher.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => router.push('/')} className="px-4 py-2 border rounded-md hover:bg-slate-50 font-medium">Decline</button>
            <button onClick={() => setHasConsented(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">I Consent</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Runner 
      sessionId={`sess-${Date.now()}`}
      config={config} 
      onComplete={() => router.push(`/participant/experiments/${params.id}/complete`)} 
    />
  );
}
''')

# Participant Complete View
write_file(f'{BASE}/app/participant/experiments/[id]/complete/page.tsx', '''
import Link from 'next/link';

export default function CompletePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
      <div className="bg-white max-w-md w-full p-8 rounded-lg shadow-sm border">
        <div className="text-green-500 mb-4 flex justify-center">
          <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Experiment Completed!</h1>
        <p className="text-slate-600 mb-8">Thank you for your participation. Your anonymous responses have been successfully recorded.</p>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-8 font-medium">
          Reward earned: +10 Points
        </div>
        <Link href="/" className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-medium">
          Return Home
        </Link>
      </div>
    </div>
  );
}
''')

print("Done writing boilerplate.")
