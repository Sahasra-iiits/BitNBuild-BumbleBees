"use client";
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function ResearcherLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // If in builder or preview, we might want to hide the sidebar, but we'll keep it for now.
  const isBuilder = pathname.includes('/builder') || pathname.includes('/preview');

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isBuilder) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-4 border-b font-black tracking-tight text-slate-900 text-lg">CogniScale</div>
        <div className="px-6 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Researcher</div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          <Link href="/researcher/experiments" className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/researcher/experiments' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>Experiments</Link>
          <Link href="/researcher/experiments/new" className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/researcher/experiments/new' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>Create New</Link>
          <Link href="/researcher/profile" className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === '/researcher/profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>Profile</Link>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="px-3 mb-2 text-sm text-slate-600 font-medium truncate" title={user?.email}>{user?.email}</div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
