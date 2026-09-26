import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div className="font-bold text-xl tracking-tight">CogniScale</div>
        <nav className="flex gap-6">
          <Link href="/experiments" className="text-sm font-medium hover:text-blue-600">Experiments</Link>
          <Link href="/how-it-works" className="text-sm font-medium hover:text-blue-600">How It Works</Link>
          <Link href="/login" className="text-sm font-medium hover:text-blue-600">Login</Link>
          <Link href="/register" className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800">Sign Up</Link>
        </nav>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <h1 className="text-5xl font-extrabold tracking-tight mb-6 max-w-3xl">
          Build behavioral experiments.<br/>
          <span className="text-blue-600">Collect research-grade data.</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mb-10">
          A secure, flexible, and high-precision SaaS platform empowering researchers to build and deploy complex behavioral experiments directly in the browser.
        </p>
        <div className="flex gap-4">
          <Link href="/register" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 shadow-sm">
            Create an Experiment
          </Link>
          <Link href="/experiments" className="bg-white border border-slate-200 text-slate-900 px-8 py-3 rounded-lg font-medium text-lg hover:bg-slate-50 shadow-sm">
            Explore Experiments
          </Link>
        </div>
      </main>
    </div>
  );
}
