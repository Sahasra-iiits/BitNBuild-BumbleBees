"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { ApiRequestError, errorMessage } from '@/lib/api/client';

/** Same-site participant paths only (no open redirect). */
function participantNext(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/participant') && !next.startsWith('//') ? next : null;
}

/** "Continue as guest": take part in guest-enabled public experiments without an account. */
export function GuestButton() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await continueAsGuest();
      router.push(participantNext() ?? '/participant/experiments');
    } catch (err) {
      setError(err instanceof ApiRequestError && err.code === 'RATE_LIMITED' ? 'Too many attempts. Please wait a few minutes and try again.' : errorMessage(err, 'Could not start a guest visit.'));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex-1 border-t" /> or <span className="flex-1 border-t" />
      </div>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <UserRound className="w-4 h-4" /> {busy ? 'Starting…' : 'Continue as guest'}
      </button>
      <p className="text-xs text-slate-500 text-center">No account needed. Guests can take part in public experiments that allow guests.</p>
      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
