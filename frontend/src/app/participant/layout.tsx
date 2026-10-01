"use client";
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth, useRequireRole } from '@/lib/context/AuthContext';
import type { UserRole } from '@/lib/types/api';

const PARTICIPANT_ROLES: UserRole[] = ['PARTICIPANT'];

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [signedOutTarget, setSignedOutTarget] = useState<string | null>(null);
  const { allowed, user } = useRequireRole(PARTICIPANT_ROLES, signedOutTarget);
  const pathname = usePathname();

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking your session…
      </div>
    );
  }

  // The experiment runner uses the whole window without navigation.
  if (pathname.endsWith('/run')) return <>{children}</>;

  const isGuest = !!user?.isGuest;
  const handleLogout = async () => {
    // Guests go back to the home page; members to the login page.
    setSignedOutTarget(isGuest ? '/' : '/login');
    await logout();
  };

  const link = (href: string, label: string) => (
    <Link href={href} className={`hover:text-blue-600 ${pathname === href ? 'text-blue-600' : 'text-slate-600'}`}>
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-3 justify-between items-center">
          <div className="flex items-center gap-5">
            <Link href="/participant" className="font-black text-lg tracking-tight">
              CogniScale
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm font-medium">
              {link('/participant', 'Dashboard')}
              {link('/participant/experiments', 'Discover')}
              {link('/participant/history', 'History')}
              {!isGuest && link('/participant/rating', 'Rating')}
              {!isGuest && link('/participant/profile', 'Profile')}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:inline">{isGuest ? `Guest ${user?.participantProfile?.pseudonymousId ?? ''}` : user?.email}</span>
            <button type="button" onClick={() => void handleLogout()} className="text-sm text-slate-600 border px-3 py-1 rounded-lg hover:bg-slate-50">
              {isGuest ? 'End guest visit' : 'Sign out'}
            </button>
          </div>
        </div>
        {isGuest && (
          <div className="bg-amber-50 border-t border-amber-200 text-amber-900 text-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>You are taking part as a guest. Only public experiments that allow guests are shown.</span>
              <Link href="/register" className="font-medium underline">
                Create a free account
              </Link>
              <span className="text-amber-800/80">to see every study. Your guest history is lost when you end the visit.</span>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
