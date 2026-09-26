"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth, useRequireRole } from '@/lib/context/AuthContext';
import type { UserRole } from '@/lib/types/api';

const RESEARCHER_ROLES: UserRole[] = ['RESEARCHER', 'ADMIN'];

export default function ResearcherLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { allowed, user } = useRequireRole(RESEARCHER_ROLES);
  const router = useRouter();
  const pathname = usePathname();

  // Nothing is rendered until the role is confirmed: no flash of researcher UI and
  // no API calls that would fail with 401/403.
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking your session…
      </div>
    );
  }

  // The builder and preview use the whole window.
  if (pathname.includes('/builder') || pathname.includes('/preview')) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === href ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-slate-50">
      <aside className="md:w-60 bg-white border-b md:border-b-0 md:border-r flex md:flex-col shrink-0">
        <div className="px-5 py-4 md:border-b font-black tracking-tight text-slate-900 text-lg">CogniScale</div>
        <nav className="flex md:flex-col flex-1 md:overflow-y-auto px-3 py-3 gap-1">
          {navLink('/researcher/experiments', 'Experiments')}
          {navLink('/researcher/experiments/new', 'Create new')}
          {navLink('/researcher/profile', 'Profile')}
        </nav>
        <div className="p-3 md:border-t border-slate-100 flex md:flex-col items-center md:items-stretch gap-2">
          <div className="px-3 text-sm text-slate-600 font-medium truncate hidden md:block" title={user?.email}>
            {user?.email}
          </div>
          <button type="button" onClick={() => void handleLogout()} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 font-medium rounded-lg hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 md:overflow-y-auto p-4 sm:p-8">{children}</main>
    </div>
  );
}
