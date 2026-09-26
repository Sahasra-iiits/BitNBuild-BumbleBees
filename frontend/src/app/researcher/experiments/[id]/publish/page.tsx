"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Copy, Globe, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function PublishPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [trialsCount, setTrialsCount] = useState(0);
  const [published, setPublished] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch to get current status and trial count
    const fetchExp = async () => {
      try {
        const { experimentsApi, versionsApi } = await import('@/lib/api/experiments');
        const exp = await experimentsApi.get(id);
        const versions = await versionsApi.list(id);
        
        if (exp.status === 'PUBLISHED') {
          setPublished(true);
        }
        setVisibility(exp.visibility.toLowerCase() as 'public' | 'private');
        
        // Count trials from the latest version or builder state
        if (versions.length > 0) {
          setTrialsCount(versions[0].configSnapshot.trials?.length || 0);
        } else {
          // Fallback to local storage if draft has not been versioned yet
          const saved = localStorage.getItem(`bitnbuild:experiment:${id}`);
          if (saved) {
             setTrialsCount(JSON.parse(saved).trials?.length || 0);
          }
        }
      } catch (err) {
        console.error("Failed to load experiment", err);
      }
    };
    fetchExp();
  }, [id]);

  const handlePublish = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { experimentsApi, versionsApi } = await import('@/lib/api/experiments');
      
      // Update visibility first
      await experimentsApi.update(id, { visibility: visibility.toUpperCase() as any });
      
      // If there are unsaved trials in localStorage, create a version with them
      const saved = localStorage.getItem(`bitnbuild:experiment:${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.trials && parsed.trials.length > 0) {
          // Send root-level trials to match backend validation schema
          await versionsApi.create(id, {
            trials: parsed.trials,
            logicRules: [],
            randomization: []
          } as any); // Cast as any because the frontend types defined it incorrectly as nested
        }
      }
      
      // Then publish
      await experimentsApi.publish(id);
      
      setPublished(true);
      
      // Clean up local storage draft
      localStorage.removeItem(`bitnbuild:experiment:${id}`);

      // Bust caches so dashboard updates
      router.refresh();
      queryClient.invalidateQueries({ queryKey: ['researcher-experiments'] });
      queryClient.invalidateQueries({ queryKey: ['public-experiments'] });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to publish experiment');
    } finally {
      setIsLoading(false);
    }
  };

  const participantLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/participant/experiments/${id}/run`;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Review & Publish</h1>
        <p className="text-slate-500 mt-2">Ensure all configurations are correct before going live.</p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-semibold text-lg flex items-center justify-between">
          Pre-flight Checklist
          <span className="text-sm font-normal text-slate-500">{trialsCount} Trials Found</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Basic Information complete</div>
          <div className="flex items-center gap-3 text-emerald-600"><CheckCircle2 className="w-5 h-5"/> Trials configured ({trialsCount} total)</div>
          <div className="flex items-center gap-3 text-slate-500"><AlertCircle className="w-5 h-5"/> Logic branching (Not used)</div>
        </div>
      </div>

      {!published ? (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-slate-700">Visibility Settings</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-1" />
                <div>
                  <div className="font-medium flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Public Link</div>
                  <div className="text-sm text-slate-500">Anyone with the link can participate without an account.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-1" />
                <div>
                  <div className="font-medium flex items-center gap-2"><Lock className="w-4 h-4 text-slate-500" /> Private (Invite Only)</div>
                  <div className="text-sm text-slate-500">Only registered users you invite can participate.</div>
                </div>
              </label>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="text-red-500 bg-red-50 px-4 py-2 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <button 
              onClick={handlePublish} 
              disabled={isLoading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? 'Publishing...' : 'Publish Experiment Now'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-800">Experiment is Live!</h2>
          <p className="text-emerald-700">Your experiment is now published and ready for participants.</p>
          
          <div className="mt-6 p-4 bg-white border border-emerald-200 rounded-lg text-left shadow-sm">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Participant Link ({visibility})</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-slate-50 rounded text-sm text-slate-700 border select-all overflow-x-auto whitespace-nowrap">
                {participantLink}
              </code>
              <button 
                onClick={() => navigator.clipboard.writeText(participantLink)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border transition-colors flex items-center gap-2"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              <a 
                href={participantLink}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 transition-colors font-medium text-sm"
              >
                Open
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
