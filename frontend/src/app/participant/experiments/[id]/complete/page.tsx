"use client";
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Star, Trophy } from 'lucide-react';

export default function CompleteExperimentPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
      <div className="text-center max-w-lg">

        {/* Success icon */}
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-14 h-14 text-emerald-500" />
        </div>

        <h1 className="text-4xl font-black text-slate-900 mb-2">Experiment Complete!</h1>
        <p className="text-lg text-slate-500 mb-8">
          Thank you for participating. Your responses have been securely recorded.
        </p>

        {/* Reward display */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            <h2 className="text-xl font-bold text-slate-800">Reward Earned</h2>
          </div>
          <div className="text-5xl font-black text-emerald-600 my-3">+10 pts</div>
          <p className="text-sm text-slate-500">
            Points have been added to your participation score.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Note: Reward points are distinct from your quality score.
          </p>
        </div>

        {/* Privacy assurance */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 text-left text-sm text-slate-600">
          <div className="font-semibold mb-1 text-slate-800">Your data remains anonymous</div>
          Your responses are permanently stored under a randomly generated participant code. 
          No personally identifiable information is linked to your responses.
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/participant/experiments"
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
          >
            Find More Experiments
          </Link>
          <Link
            href="/participant"
            className="px-6 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
          >
            My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
