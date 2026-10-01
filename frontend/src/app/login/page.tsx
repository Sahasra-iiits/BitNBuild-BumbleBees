"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { homeForRole, useAuth } from '@/lib/context/AuthContext';
import { ApiRequestError } from '@/lib/api/client';
import { GuestButton } from '@/components/auth/GuestButton';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError(null);

    try {
      const user = await login(email, password);
      // Only same-site paths are accepted as a return target (no open redirect).
      const next = new URLSearchParams(window.location.search).get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      const home = homeForRole(user.role);
      const allowedNext = safeNext && (user.role === 'PARTICIPANT' ? safeNext.startsWith('/participant') : safeNext.startsWith('/researcher'));
      router.push(allowedNext ? safeNext : home);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'UNAUTHORIZED') {
          setError('Incorrect email or password. Please try again.');
        } else if (err.code === 'RATE_LIMITED') {
          setError('Too many login attempts. Please wait a few minutes and try again.');
        } else {
          setError(err.message || 'Login failed. Please try again.');
        }
      } else {
        setError('Unable to connect to server. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="font-bold text-2xl tracking-tight text-slate-900 mb-1">CogniScale</div>
          <h1 className="text-lg font-semibold text-slate-700 mt-3">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Log in to your research account.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="you@university.edu"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6">
          <GuestButton />
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Create one
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
