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
