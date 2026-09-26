"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ParticipantAccessPage() {
  const params = useParams();
  
  const [visibility, setVisibility] = useState('public');
  const [ageRestricted, setAgeRestricted] = useState(true);
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('65');
  const [ratingRestricted, setRatingRestricted] = useState(true);
  const [minRating, setMinRating] = useState('75');
  const [reward, setReward] = useState('10');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
        <Link href="/researcher/experiments" className="hover:text-blue-600">Experiments</Link>
        <span>/</span>
        <span>Visual Working Memory Task</span>
        <span>/</span>
        <span className="font-medium text-slate-900">Participant Access</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Participant Access</h1>
        <p className="text-slate-500 mt-1">Configure who can discover and participate in your experiment.</p>
      </div>

      <div className="bg-white border rounded-lg shadow-sm divide-y">
        
        {/* Visibility */}
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Experiment Visibility</h2>
          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-colors ${visibility === 'public' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-1 accent-blue-600" />
              <div>
                <div className="font-medium text-slate-900">Public Discovery</div>
                <div className="text-sm text-slate-500">Experiment appears in the participant dashboard and search. Open to any eligible user.</div>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-colors ${visibility === 'private' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-1 accent-blue-600" />
              <div>
                <div className="font-medium text-slate-900">Private / Invite Only</div>
                <div className="text-sm text-slate-500">Hidden from public discovery. Participants can only join via direct link or QR code.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Age Restrictions */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold">Age Restrictions</h2>
              <p className="text-sm text-slate-500">Limit participation based on age.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={ageRestricted} onChange={e => setAgeRestricted(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {ageRestricted && (
            <div className="flex gap-4 pt-2">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Minimum Age</label>
                <input type="number" value={minAge} onChange={e => setMinAge(e.target.value)} className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Maximum Age</label>
                <input type="number" value={maxAge} onChange={e => setMaxAge(e.target.value)} className="w-full border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              </div>
            </div>
          )}
        </div>

        {/* Quality Rating */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold">Quality Rating Requirement</h2>
              <p className="text-sm text-slate-500">Filter out low-quality participants.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={ratingRestricted} onChange={e => setRatingRestricted(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {ratingRestricted && (
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Minimum Participant Rating (0-100)</label>
              <input type="number" value={minRating} onChange={e => setMinRating(e.target.value)} className="w-full max-w-[200px] border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
              <p className="text-xs text-slate-500 mt-1">Participants with a score below this threshold will not be eligible.</p>
            </div>
          )}
        </div>

        {/* Reward */}
        <div className="p-6 bg-slate-50">
          <h2 className="text-lg font-bold mb-4">Completion Reward</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reward Points (0-20)</label>
            <input type="number" max="20" min="0" value={reward} onChange={e => setReward(e.target.value)} className="w-full max-w-[200px] border rounded-md px-3 py-2 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" />
            <p className="text-xs text-slate-500 mt-1">Points are awarded to participants upon successful completion.</p>
          </div>
        </div>

      </div>

      <div className="flex justify-end">
        <button className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700">Save Configuration</button>
      </div>
    </div>
  );
}
