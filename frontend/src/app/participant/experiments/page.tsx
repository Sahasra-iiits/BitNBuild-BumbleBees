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
