import Link from 'next/link';

export default function ResearcherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-4 border-b font-bold tracking-tight">CogniScale Researcher</div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link href="/researcher/experiments" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Experiments</Link>
          <Link href="/researcher/experiments/new" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Create New</Link>
          <Link href="/researcher/profile" className="block px-3 py-2 rounded-md hover:bg-slate-100 text-sm font-medium">Profile</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
