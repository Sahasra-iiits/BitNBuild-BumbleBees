"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { publicExperimentsApi } from '@/lib/api/experiments';
import { sessionsApi } from '@/lib/api/sessions';
import { consentApi, hashConsentText } from '@/lib/api/consent';
import { qualityApi } from '@/lib/api/quality';
import { Experiment, ExperimentVersion } from '@/lib/types/api';
import { ApiRequestError } from '@/lib/api/client';
import ExperimentRunner from '@/components/experiment/Runner';

type Phase = 'loading' | 'eligibility_error' | 'consent' | 'running' | 'completing' | 'error';

const CONSENT_TEXT = `You are invited to participate in a research study conducted via the CogniScale platform.

Your participation is completely voluntary. You may withdraw at any time without penalty.

All data collected will be completely anonymous. Your responses will be identified only by a randomly generated participant code, never by your name or email.

The study involves responding to stimuli displayed on your screen. Estimated duration is shown on the experiment card.

By clicking "I Consent", you confirm that you understand and agree to participate.`;

export default function RunExperimentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState<ExperimentVersion | null>(null);
  const [rewardEarned, setRewardEarned] = useState<number | null>(null);

  // Step 1: Check eligibility on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [exp, eligibility] = await Promise.all([
          publicExperimentsApi.get(id),
          publicExperimentsApi.checkEligibility(id),
        ]);
        setExperiment(exp);

        if (!eligibility.eligible) {
          setError(eligibility.reason || 'You are not eligible for this experiment.');
          setPhase('eligibility_error');
          return;
        }
        setPhase('consent');
      } catch (err) {
        if (err instanceof ApiRequestError) {
          if (err.code === 'EXPERIMENT_NOT_ELIGIBLE') {
            setError('You are not eligible for this experiment.');
            setPhase('eligibility_error');
          } else if (err.code === 'ATTEMPT_LIMIT_REACHED') {
            setError('You have already completed this experiment the maximum number of times.');
            setPhase('eligibility_error');
          } else if (err.statusCode === 404) {
            setError('This experiment was not found or is no longer available.');
            setPhase('eligibility_error');
          } else {
            setError('Unable to load experiment. Please try again.');
            setPhase('error');
          }
        } else {
          setError('Unable to connect. Please check your internet connection.');
          setPhase('error');
        }
      }
    };

    init();
  }, [id]);

  // Step 2: Record consent + start session
  const handleConsent = async () => {
    if (!experiment) return;
    setPhase('loading');

    try {
      // Record consent
      const consent = await consentApi.record({
        experimentId: id,
        versionId: experiment.id, // Current active version
        consentVersion: '1.0',
        consentTextHash: hashConsentText(CONSENT_TEXT),
      });

      // Start session — returns full version config for local runner
      const session = await sessionsApi.start(id, {
        consentId: consent.id,
        idempotencyKey: `${id}-${Date.now()}`,
      });

      setSessionId(session.id);
      setVersion(session.version);
      setPhase('running');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to start session. Please try again.');
      }
      setPhase('error');
    }
  };

  // Step 3: Complete session
  const handleComplete = async () => {
    if (!sessionId) return;
    setPhase('completing');

    try {
      await sessionsApi.complete(sessionId);
      setRewardEarned(experiment?.rewardPoints ?? null);
      router.push(`/participant/experiments/${id}/complete`);
    } catch (err) {
      // Even if completion fails, don't block the user
      console.error('Session completion error:', err);
      router.push(`/participant/experiments/${id}/complete`);
    }
  };

  // Loading
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-slate-600">Loading experiment...</div>
        </div>
      </div>
    );
  }

  // Eligibility / access errors
  if (phase === 'eligibility_error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white border rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Not Available</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => router.push('/participant/experiments')} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors">
            Find Other Experiments
          </button>
        </div>
      </div>
    );
  }

  // General error
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white border rounded-xl shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Consent screen
  if (phase === 'consent') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full rounded-xl shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Informed Consent</h1>
          {experiment && (
            <p className="text-blue-700 font-medium text-sm mb-4">{experiment.title}</p>
          )}
          <div className="bg-slate-50 rounded-lg p-5 mb-6 text-sm text-slate-700 leading-relaxed whitespace-pre-line font-mono border">
            {CONSENT_TEXT}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/participant/experiments')}
              className="px-5 py-2.5 border rounded-lg hover:bg-slate-50 font-medium text-slate-700 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={handleConsent}
              className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              I Consent — Begin Experiment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Experiment runner
  if (phase === 'running' && sessionId && version) {
    return (
      <ExperimentRunner
        sessionId={sessionId}
        version={version}
        onComplete={handleComplete}
        isPreview={false}
      />
    );
  }

  // Completing
  if (phase === 'completing') {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-slate-600 text-lg">Saving your responses...</div>
      </div>
    );
  }

  return null;
}
