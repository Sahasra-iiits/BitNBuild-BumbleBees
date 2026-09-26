"use client";
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // If in the middle of running an experiment, hide the global layout nav
  if (pathname.includes('/run')) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-black text-lg tracking-tight">CogniScale</Link>
            <nav className="flex gap-4 text-sm font-medium">
              <Link href="/participant" className={`hover:text-blue-600 ${pathname === '/participant' ? 'text-blue-600' : 'text-slate-600'}`}>Dashboard</Link>
              <Link href="/participant/experiments" className={`hover:text-blue-600 ${pathname === '/participant/experiments' ? 'text-blue-600' : 'text-slate-600'}`}>Discover</Link>
              <Link href="/participant/profile" className={`hover:text-blue-600 ${pathname === '/participant/profile' ? 'text-blue-600' : 'text-slate-600'}`}>Profile</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-900 border px-3 py-1 rounded-lg hover:bg-slate-50 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
